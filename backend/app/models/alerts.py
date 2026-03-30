from pydantic import BaseModel


class AlertOut(BaseModel):
    id: str
    type: str
    timestamp: str
    patient_id: str
