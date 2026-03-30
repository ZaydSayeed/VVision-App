from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from ..core.database import get_db
from ..core.security import get_current_user
from ..core.patient_resolver import resolve_patient_id
from ..models.patient import PatientOut, PatientUpdate, LinkPatientRequest

router = APIRouter(prefix="/api/patients", tags=["patients"])


def _patient_to_out(doc: dict) -> PatientOut:
    return PatientOut(
        id=str(doc["_id"]),
        name=doc["name"],
        age=doc.get("age"),
        diagnosis=doc.get("diagnosis"),
        notes=doc.get("notes", ""),
        caregiver_id=doc.get("caregiver_id", ""),
        caregiver_ids=doc.get("caregiver_ids", []),
        link_code=doc.get("link_code", ""),
    )


@router.get("/mine", response_model=PatientOut)
async def get_my_patient(patient_id: str = Depends(resolve_patient_id)):
    """Get the patient profile for the current user (works for both roles)."""
    db = get_db()
    patient = await db["patients"].find_one({"_id": ObjectId(patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return _patient_to_out(patient)


@router.patch("/mine", response_model=PatientOut)
async def update_my_patient(
    body: PatientUpdate, patient_id: str = Depends(resolve_patient_id)
):
    db = get_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    await db["patients"].update_one(
        {"_id": ObjectId(patient_id)}, {"$set": updates}
    )
    patient = await db["patients"].find_one({"_id": ObjectId(patient_id)})
    return _patient_to_out(patient)


@router.get("/mine/link-code")
async def get_link_code(user_id: str = Depends(get_current_user)):
    """Get the patient's link code (for sharing with caregivers). Patient only."""
    db = get_db()
    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    if not user or user.get("role") != "patient":
        raise HTTPException(status_code=403, detail="Only patients have a link code")
    if not user.get("patient_id"):
        raise HTTPException(status_code=404, detail="No patient profile found")

    patient = await db["patients"].find_one({"_id": ObjectId(user["patient_id"])})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    return {"link_code": patient.get("link_code", "")}


@router.post("/link", response_model=PatientOut)
async def link_to_patient(
    body: LinkPatientRequest, user_id: str = Depends(get_current_user)
):
    """Caregiver enters a patient's link code to connect their accounts."""
    db = get_db()
    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    if not user or user.get("role") != "caregiver":
        raise HTTPException(status_code=403, detail="Only caregivers can link to a patient")
    if user.get("patient_id"):
        raise HTTPException(status_code=409, detail="You are already linked to a patient")

    code = body.link_code.strip().upper()
    patient = await db["patients"].find_one({"link_code": code})
    if not patient:
        raise HTTPException(status_code=404, detail="Invalid link code")

    patient_id = str(patient["_id"])

    # Add caregiver to patient's list
    await db["patients"].update_one(
        {"_id": patient["_id"]},
        {"$addToSet": {"caregiver_ids": user_id}},
    )

    # Link caregiver to patient
    await db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"patient_id": patient_id}},
    )

    patient = await db["patients"].find_one({"_id": ObjectId(patient_id)})
    return _patient_to_out(patient)
