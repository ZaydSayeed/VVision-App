"""
Auth router — works with Supabase Auth.

Supabase handles signup/login on the frontend. This router provides:
  - POST /api/auth/sync — create/update the MongoDB user profile after Supabase login
  - GET /api/auth/me — get current user profile from MongoDB
"""

import secrets
import string
from typing import Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..core.database import get_db
from ..core.security import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SyncRequest(BaseModel):
    name: str
    role: Literal["patient", "caregiver"]


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    patient_id: str | None = None


def _generate_link_code(length: int = 6) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


@router.post("/sync", response_model=UserOut)
async def sync_profile(body: SyncRequest, supabase_uid: str = Depends(get_current_user)):
    """
    Called after Supabase signup/login.
    Creates the MongoDB user doc if it doesn't exist, returns the profile.
    """
    db = get_db()
    users = db["users"]

    # Check if user already exists (by Supabase UID)
    user = await users.find_one({"supabase_uid": supabase_uid})

    if user:
        # Return existing profile
        return UserOut(
            id=str(user["_id"]),
            email=user.get("email", ""),
            name=user.get("name", body.name),
            role=user.get("role", body.role),
            patient_id=str(user["patient_id"]) if user.get("patient_id") else None,
        )

    # Get email from Supabase
    import httpx
    from ..core.config import settings

    email = ""
    try:
        # We have the token in the request, reuse it
        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"{settings.supabase_url}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {supabase_uid}",
                    "apikey": settings.supabase_anon_key,
                },
                timeout=5.0,
            )
            if res.status_code == 200:
                email = res.json().get("email", "")
    except Exception:
        pass

    # Create new user doc
    user_doc = {
        "supabase_uid": supabase_uid,
        "email": email,
        "name": body.name,
        "role": body.role,
        "patient_id": None,
    }
    result = await users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    patient_id = None

    # If patient, auto-create patient record with link code
    if body.role == "patient":
        link_code = _generate_link_code()
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

        await users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"patient_id": patient_id}},
        )

    return UserOut(
        id=user_id,
        email=email,
        name=body.name,
        role=body.role,
        patient_id=patient_id,
    )


@router.get("/me", response_model=UserOut)
async def get_me(supabase_uid: str = Depends(get_current_user)):
    db = get_db()
    user = await db["users"].find_one({"supabase_uid": supabase_uid})
    if not user:
        raise HTTPException(status_code=404, detail="Profile not synced yet. Call /api/auth/sync first.")

    return UserOut(
        id=str(user["_id"]),
        email=user.get("email", ""),
        name=user.get("name", ""),
        role=user.get("role", "caregiver"),
        patient_id=str(user["patient_id"]) if user.get("patient_id") else None,
    )
