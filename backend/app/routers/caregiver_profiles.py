from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from ..core.database import get_db
from ..core.patient_resolver import resolve_patient_id

router = APIRouter(prefix="/api/caregiver-profiles", tags=["caregiver-profiles"])


@router.get("")
async def list_caregiver_profiles(patient_id: str = Depends(resolve_patient_id)):
    """List all caregivers linked to the current patient."""
    db = get_db()
    patient = await db["patients"].find_one({"_id": ObjectId(patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    caregiver_ids = patient.get("caregiver_ids", [])
    if not caregiver_ids:
        return []

    caregivers = []
    for cid in caregiver_ids:
        user = await db["users"].find_one({"_id": ObjectId(cid)})
        if user:
            caregivers.append({
                "id": str(user["_id"]),
                "name": user["name"],
                "email": user["email"],
            })

    return caregivers
