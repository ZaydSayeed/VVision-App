from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from ..core.database import get_db
from ..core.patient_resolver import resolve_patient_id
from ..models.routine import RoutineTaskCreate, RoutineTaskOut, RoutineTaskUpdate

router = APIRouter(prefix="/api/routines", tags=["routines"])


def _doc_to_out(doc: dict) -> RoutineTaskOut:
    return RoutineTaskOut(
        id=str(doc["_id"]),
        label=doc["label"],
        time=doc["time"],
        completed_date=doc.get("completed_date"),
        patient_id=str(doc["patient_id"]),
    )


@router.get("", response_model=list[RoutineTaskOut])
async def list_routines(patient_id: str = Depends(resolve_patient_id)):
    db = get_db()
    docs = await db["routines"].find({"patient_id": patient_id}).to_list(length=200)
    return [_doc_to_out(d) for d in docs]


@router.post("", response_model=RoutineTaskOut, status_code=201)
async def create_routine(
    body: RoutineTaskCreate, patient_id: str = Depends(resolve_patient_id)
):
    db = get_db()
    doc = {
        "label": body.label,
        "time": body.time,
        "completed_date": None,
        "patient_id": patient_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db["routines"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _doc_to_out(doc)


@router.patch("/{routine_id}", response_model=RoutineTaskOut)
async def update_routine(
    routine_id: str,
    body: RoutineTaskUpdate,
    patient_id: str = Depends(resolve_patient_id),
):
    db = get_db()
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await db["routines"].update_one(
        {"_id": ObjectId(routine_id), "patient_id": patient_id},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Routine not found")

    doc = await db["routines"].find_one({"_id": ObjectId(routine_id)})
    return _doc_to_out(doc)


@router.delete("/{routine_id}", status_code=204)
async def delete_routine(
    routine_id: str, patient_id: str = Depends(resolve_patient_id)
):
    db = get_db()
    result = await db["routines"].delete_one(
        {"_id": ObjectId(routine_id), "patient_id": patient_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Routine not found")
