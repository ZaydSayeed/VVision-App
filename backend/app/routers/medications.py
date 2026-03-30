from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from ..core.database import get_db
from ..core.patient_resolver import resolve_patient_id
from ..models.medication import MedicationCreate, MedicationOut, MedicationUpdate

router = APIRouter(prefix="/api/medications", tags=["medications"])


def _doc_to_out(doc: dict) -> MedicationOut:
    return MedicationOut(
        id=str(doc["_id"]),
        name=doc["name"],
        dosage=doc["dosage"],
        time=doc["time"],
        taken_date=doc.get("taken_date"),
        patient_id=str(doc["patient_id"]),
    )


@router.get("", response_model=list[MedicationOut])
async def list_medications(patient_id: str = Depends(resolve_patient_id)):
    db = get_db()
    docs = await db["medications"].find({"patient_id": patient_id}).to_list(length=200)
    return [_doc_to_out(d) for d in docs]


@router.post("", response_model=MedicationOut, status_code=201)
async def create_medication(
    body: MedicationCreate, patient_id: str = Depends(resolve_patient_id)
):
    db = get_db()
    doc = {
        "name": body.name,
        "dosage": body.dosage,
        "time": body.time,
        "taken_date": None,
        "patient_id": patient_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db["medications"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _doc_to_out(doc)


@router.patch("/{med_id}", response_model=MedicationOut)
async def update_medication(
    med_id: str,
    body: MedicationUpdate,
    patient_id: str = Depends(resolve_patient_id),
):
    db = get_db()
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await db["medications"].update_one(
        {"_id": ObjectId(med_id), "patient_id": patient_id},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Medication not found")

    doc = await db["medications"].find_one({"_id": ObjectId(med_id)})
    return _doc_to_out(doc)


@router.delete("/{med_id}", status_code=204)
async def delete_medication(
    med_id: str, patient_id: str = Depends(resolve_patient_id)
):
    db = get_db()
    result = await db["medications"].delete_one(
        {"_id": ObjectId(med_id), "patient_id": patient_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Medication not found")
