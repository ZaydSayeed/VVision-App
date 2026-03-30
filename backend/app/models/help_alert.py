from pydantic import BaseModel


class HelpAlertOut(BaseModel):
    id: str
    patient_id: str
    timestamp: str
    dismissed: bool = False
