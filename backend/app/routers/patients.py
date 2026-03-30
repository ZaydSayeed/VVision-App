from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from ..core.database import get_db
from ..core.security import get_current_user
from ..models.patient import PatientCreate, PatientOut, PatientUpdate

router = APIRouter(prefix="/api/patients", tags=["patients"])


@router.post("", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
async def create_patient(body: PatientCreate, user_id: str = Depends(get_current_user)):
    db = get_db()

    # Check if caregiver already has a patient
    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    if user and user.get("patient_id"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a patient linked. Update the existing one instead.",
        )

    doc = {
        "name": body.name,
        "age": body.age,
        "diagnosis": body.diagnosis,
        "notes": body.notes,
        "caregiver_id": user_id,
    }
    result = await db["patients"].insert_one(doc)
    patient_id = str(result.inserted_id)

    # Link patient to caregiver
    await db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"patient_id": patient_id}},
    )

    return PatientOut(id=patient_id, **body.model_dump(), caregiver_id=user_id)


@router.get("/mine", response_model=PatientOut)
async def get_my_patient(user_id: str = Depends(get_current_user)):
    db = get_db()
    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    if not user or not user.get("patient_id"):
        raise HTTPException(status_code=404, detail="No patient linked to your account")

    patient = await db["patients"].find_one({"_id": ObjectId(user["patient_id"])})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    return PatientOut(
        id=str(patient["_id"]),
        name=patient["name"],
        age=patient.get("age"),
        diagnosis=patient.get("diagnosis"),
        notes=patient.get("notes", ""),
        caregiver_id=patient["caregiver_id"],
    )


@router.patch("/mine", response_model=PatientOut)
async def update_my_patient(
    body: PatientUpdate, user_id: str = Depends(get_current_user)
):
    db = get_db()
    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    if not user or not user.get("patient_id"):
        raise HTTPException(status_code=404, detail="No patient linked to your account")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    await db["patients"].update_one(
        {"_id": ObjectId(user["patient_id"])},
        {"$set": updates},
    )

    patient = await db["patients"].find_one({"_id": ObjectId(user["patient_id"])})
    return PatientOut(
        id=str(patient["_id"]),
        name=patient["name"],
        age=patient.get("age"),
        diagnosis=patient.get("diagnosis"),
        notes=patient.get("notes", ""),
        caregiver_id=patient["caregiver_id"],
    )
