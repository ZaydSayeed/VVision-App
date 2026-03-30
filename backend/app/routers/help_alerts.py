from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from ..core.database import get_db
from ..core.patient_resolver import resolve_patient_id
from ..models.help_alert import HelpAlertOut

router = APIRouter(prefix="/api/help-alerts", tags=["help-alerts"])


def _doc_to_out(doc: dict) -> HelpAlertOut:
    return HelpAlertOut(
        id=str(doc["_id"]),
        patient_id=str(doc["patient_id"]),
        timestamp=doc["timestamp"],
        dismissed=doc.get("dismissed", False),
    )


@router.get("", response_model=list[HelpAlertOut])
async def list_help_alerts(patient_id: str = Depends(resolve_patient_id)):
    db = get_db()
    docs = (
        await db["help_alerts"]
        .find({"patient_id": patient_id})
        .sort("timestamp", -1)
        .limit(50)
        .to_list(length=50)
    )
    return [_doc_to_out(d) for d in docs]


@router.post("", response_model=HelpAlertOut, status_code=201)
async def create_help_alert(patient_id: str = Depends(resolve_patient_id)):
    """Patient sends a help request."""
    db = get_db()
    doc = {
        "patient_id": patient_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "dismissed": False,
    }
    result = await db["help_alerts"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _doc_to_out(doc)


@router.patch("/{alert_id}/dismiss", response_model=HelpAlertOut)
async def dismiss_help_alert(
    alert_id: str, patient_id: str = Depends(resolve_patient_id)
):
    db = get_db()
    result = await db["help_alerts"].update_one(
        {"_id": ObjectId(alert_id), "patient_id": patient_id},
        {"$set": {"dismissed": True}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Help alert not found")

    doc = await db["help_alerts"].find_one({"_id": ObjectId(alert_id)})
    return _doc_to_out(doc)
