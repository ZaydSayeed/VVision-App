import secrets
import string

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from ..core.database import get_db
from ..core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)
from ..models.auth import (
    SignupRequest,
    LoginRequest,
    AuthResponse,
    UserOut,
    ResetPasswordRequest,
    DeleteAccountRequest,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _generate_link_code(length: int = 6) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


@router.post("/signup", response_model=AuthResponse)
async def signup(body: SignupRequest):
    db = get_db()
    users = db["users"]

    existing = await users.find_one({"email": body.email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user_doc = {
        "email": body.email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": body.role,
        "patient_id": None,
    }
    result = await users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    patient_id = None

    # If signing up as patient, auto-create their patient record
    if body.role == "patient":
        link_code = _generate_link_code()
        # Ensure uniqueness
        while await db["patients"].find_one({"link_code": link_code}):
            link_code = _generate_link_code()

        patient_doc = {
            "name": body.name,
            "age": None,
            "diagnosis": None,
            "notes": "",
            "caregiver_id": "",
            "caregiver_ids": [],
            "link_code": link_code,
        }
        patient_result = await db["patients"].insert_one(patient_doc)
        patient_id = str(patient_result.inserted_id)

        # Link patient back to user
        await users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"patient_id": patient_id}},
        )

    token = create_access_token(user_id)
    return AuthResponse(
        access_token=token,
        user=UserOut(
            id=user_id,
            email=body.email,
            name=body.name,
            role=body.role,
            patient_id=patient_id,
        ),
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    db = get_db()
    users = db["users"]

    user = await users.find_one({"email": body.email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user_id = str(user["_id"])
    token = create_access_token(user_id)
    return AuthResponse(
        access_token=token,
        user=UserOut(
            id=user_id,
            email=user["email"],
            name=user["name"],
            role=user.get("role", "caregiver"),
            patient_id=str(user["patient_id"]) if user.get("patient_id") else None,
        ),
    )


@router.get("/me", response_model=UserOut)
async def get_me(user_id: str = Depends(get_current_user)):
    db = get_db()
    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserOut(
        id=str(user["_id"]),
        email=user["email"],
        name=user["name"],
        role=user.get("role", "caregiver"),
        patient_id=str(user["patient_id"]) if user.get("patient_id") else None,
    )


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest):
    """Reset password by email. Simple reset — no email verification."""
    db = get_db()
    user = await db["users"].find_one({"email": body.email})
    if not user:
        # Don't reveal whether email exists
        return {"status": "ok"}

    await db["users"].update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": hash_password(body.new_password)}},
    )
    return {"status": "ok"}


@router.delete("/account")
async def delete_account(
    body: DeleteAccountRequest, user_id: str = Depends(get_current_user)
):
    """Delete the current user's account and clean up linked data."""
    db = get_db()
    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify password before deletion
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password",
        )

    patient_id = user.get("patient_id")
    role = user.get("role", "caregiver")

    if role == "patient" and patient_id:
        # Remove patient doc and all associated data
        pid = ObjectId(patient_id)
        await db["patients"].delete_one({"_id": pid})
        await db["routines"].delete_many({"patient_id": str(patient_id)})
        await db["medications"].delete_many({"patient_id": str(patient_id)})
        await db["help_alerts"].delete_many({"patient_id": str(patient_id)})
        # Unlink all caregivers connected to this patient
        await db["users"].update_many(
            {"patient_id": str(patient_id), "role": "caregiver"},
            {"$set": {"patient_id": None}},
        )

    elif role == "caregiver" and patient_id:
        # Remove caregiver from patient's caregiver list
        await db["patients"].update_one(
            {"_id": ObjectId(patient_id)},
            {"$pull": {"caregiver_ids": user_id}},
        )

    # Delete the user
    await db["users"].delete_one({"_id": ObjectId(user_id)})

    return {"status": "ok"}
