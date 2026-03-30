from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from ..core.database import get_db
from ..core.security import get_current_user
from ..models.people import PersonOut, PersonUpdate, NotesUpdate, Interaction

router = APIRouter(prefix="/api/people", tags=["people"])


async def _get_patient_id(user_id: str) -> str:
    """Resolve the patient_id for the current caregiver."""
    db = get_db()
    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    if not user or not user.get("patient_id"):
        raise HTTPException(status_code=404, detail="No patient linked to your account")
    return str(user["patient_id"])


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
async def list_people(user_id: str = Depends(get_current_user)):
    """List all people in the patient's contact database."""
    db = get_db()
    # Return all people from the shared 'people' collection.
    # The glasses write here; the app reads from here.
    docs = await db["people"].find({}, {"embedding": 0}).to_list(length=500)
    return [_doc_to_person(d) for d in docs]


@router.get("/{person_id}", response_model=PersonOut)
async def get_person(person_id: str, user_id: str = Depends(get_current_user)):
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
    user_id: str = Depends(get_current_user),
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
    user_id: str = Depends(get_current_user),
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


# Legacy endpoint — matches the original dashboard API shape
# so the existing frontend keeps working during migration.
@router.post("/by-name/{name}/notes")
async def update_notes_by_name(name: str, body: NotesUpdate):
    db = get_db()
    result = await db["people"].update_one(
        {"name": name}, {"$set": {"notes": body.notes}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Person not found")
    return {"status": "ok"}
