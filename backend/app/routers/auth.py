from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from ..core.database import get_db
from ..core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)
from ..models.auth import SignupRequest, LoginRequest, AuthResponse, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


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

    doc = {
        "email": body.email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "patient_id": None,
    }
    result = await users.insert_one(doc)
    user_id = str(result.inserted_id)

    token = create_access_token(user_id)
    return AuthResponse(
        access_token=token,
        user=UserOut(
            id=user_id,
            email=body.email,
            name=body.name,
            patient_id=None,
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
        patient_id=str(user["patient_id"]) if user.get("patient_id") else None,
    )
