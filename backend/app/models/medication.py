from pydantic import BaseModel


class MedicationCreate(BaseModel):
    name: str
    dosage: str
    time: str


class MedicationOut(BaseModel):
    id: str
    name: str
    dosage: str
    time: str
    taken_date: str | None = None
    patient_id: str


class MedicationUpdate(BaseModel):
    name: str | None = None
    dosage: str | None = None
    time: str | None = None
    taken_date: str | None = None
