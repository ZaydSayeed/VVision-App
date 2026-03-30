import os
import uuid
from pathlib import Path

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from ..core.database import get_db
from ..core.security import get_current_user
from ..core.patient_resolver import resolve_patient_id
from ..models.people import PersonOut, PersonUpdate, NotesUpdate, Interaction

router = APIRouter(prefix="/api/people", tags=["people"])

UPLOAD_DIR = Path("uploads/faces")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _doc_to_person(doc: dict) -> PersonOut:
    return PersonOut(
        id=str(doc["_id"]),
        name=doc["name"],
        relation=doc.get("relation", ""),
        last_seen=doc.get("last_seen"),
        seen_count=doc.get("seen_count", 0),
        notes=doc.get("notes", ""),
        interactions=[
            Interaction(**i) for i in doc.get("interactions", [])
        ],
    )


@router.get("", response_model=list[PersonOut])
async def list_people(patient_id: str = Depends(resolve_patient_id)):
    """List all people in the patient's contact database."""
    db = get_db()
    # Return people scoped to this patient, or unscoped ones (legacy from glasses)
    query = {
        "$or": [
            {"patient_id": patient_id},
            {"patient_id": {"$exists": False}},
        ]
    }
    docs = await db["people"].find(query, {"embedding": 0}).to_list(length=500)
    return [_doc_to_person(d) for d in docs]


@router.get("/{person_id}", response_model=PersonOut)
async def get_person(
    person_id: str, patient_id: str = Depends(resolve_patient_id)
):
    db = get_db()
    doc = await db["people"].find_one(
        {"_id": ObjectId(person_id)}, {"embedding": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Person not found")
    return _doc_to_person(doc)


@router.patch("/{person_id}", response_model=PersonOut)
async def update_person(
    person_id: str,
    body: PersonUpdate,
    patient_id: str = Depends(resolve_patient_id),
):
    db = get_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await db["people"].update_one(
        {"_id": ObjectId(person_id)}, {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Person not found")

    doc = await db["people"].find_one(
        {"_id": ObjectId(person_id)}, {"embedding": 0}
    )
    return _doc_to_person(doc)


@router.post("/{person_id}/notes", response_model=PersonOut)
async def update_notes(
    person_id: str,
    body: NotesUpdate,
    patient_id: str = Depends(resolve_patient_id),
):
    db = get_db()
    result = await db["people"].update_one(
        {"_id": ObjectId(person_id)},
        {"$set": {"notes": body.notes}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Person not found")

    doc = await db["people"].find_one(
        {"_id": ObjectId(person_id)}, {"embedding": 0}
    )
    return _doc_to_person(doc)


@router.post("/enroll", response_model=PersonOut, status_code=201)
async def enroll_face(
    name: str = Form(...),
    relation: str = Form(""),
    photo: UploadFile = File(...),
    patient_id: str = Depends(resolve_patient_id),
):
    """Enroll a new face — accepts name, relation, and a photo."""
    db = get_db()

    # Save photo to disk
    ext = os.path.splitext(photo.filename or "face.jpg")[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = UPLOAD_DIR / filename

    content = await photo.read()
    with open(filepath, "wb") as f:
        f.write(content)

    doc = {
        "name": name,
        "relation": relation,
        "notes": "",
        "embedding": [],
        "last_seen": None,
        "seen_count": 0,
        "interactions": [],
        "patient_id": patient_id,
        "photo_path": str(filepath),
    }
    result = await db["people"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _doc_to_person(doc)


@router.delete("/{person_id}", status_code=204)
async def delete_person(
    person_id: str, patient_id: str = Depends(resolve_patient_id)
):
    db = get_db()
    # Try to delete the photo file too
    doc = await db["people"].find_one({"_id": ObjectId(person_id)})
    if doc and doc.get("photo_path"):
        try:
            os.remove(doc["photo_path"])
        except OSError:
            pass

    result = await db["people"].delete_one({"_id": ObjectId(person_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Person not found")


# Legacy endpoint — matches the original dashboard API shape
@router.post("/by-name/{name}/notes")
async def update_notes_by_name(name: str, body: NotesUpdate):
    db = get_db()
    result = await db["people"].update_one(
        {"name": name}, {"$set": {"notes": body.notes}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Person not found")
    return {"status": "ok"}
