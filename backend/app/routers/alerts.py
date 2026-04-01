from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from ..core.database import get_db
from ..core.patient_resolver import resolve_patient_id
from ..models.alerts import AlertOut

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
async def list_alerts(patient_id: str = Depends(resolve_patient_id)):
    """Get the 20 most recent unrecognized face alerts for this patient."""
    db = get_db()
    query = {"patient_id": patient_id}
    docs = (
        await db["alerts"]
        .find(query)
        .sort("timestamp", -1)
        .limit(20)
        .to_list(length=20)
    )
    return [
        AlertOut(
            id=str(d["_id"]),
            type=d.get("type", "unknown_face"),
            timestamp=d.get("timestamp", ""),
            patient_id=str(d.get("patient_id", patient_id)),
        )
        for d in docs
    ]


@router.delete("/{alert_id}")
async def dismiss_alert(
    alert_id: str, patient_id: str = Depends(resolve_patient_id)
):
    db = get_db()
    result = await db["alerts"].delete_one({"_id": ObjectId(alert_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "ok"}
