from pydantic import BaseModel


class PatientCreate(BaseModel):
    name: str
    age: int | None = None
    diagnosis: str | None = None
    notes: str = ""


class PatientOut(BaseModel):
    id: str
    name: str
    age: int | None = None
    diagnosis: str | None = None
    notes: str = ""
    caregiver_id: str


class PatientUpdate(BaseModel):
    name: str | None = None
    age: int | None = None
    diagnosis: str | None = None
    notes: str | None = None
