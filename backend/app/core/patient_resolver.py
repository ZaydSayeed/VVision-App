"""Shared utility to resolve patient_id for both patient and caregiver users."""

from fastapi import Depends, HTTPException

from .database import get_db
from .security import get_current_user


async def resolve_patient_id(supabase_uid: str = Depends(get_current_user)) -> str:
    """
    Dependency that returns the patient_id for the current user.

    - If the user is a patient, returns their own patient doc ID.
    - If the user is a caregiver, returns their linked patient_id.
    - Raises 404 if no patient is linked.
    """
    db = get_db()
    user = await db["users"].find_one({"supabase_uid": supabase_uid})
    if not user:
        raise HTTPException(status_code=404, detail="Profile not found. Sign in again.")

    patient_id = user.get("patient_id")
    if not patient_id:
        raise HTTPException(
            status_code=404,
            detail="No patient linked to your account. "
            + (
                "Ask your patient for their link code."
                if user.get("role") == "caregiver"
                else "Account setup incomplete."
            ),
        )
    return str(patient_id)
