from pydantic import BaseModel


class RoutineTaskCreate(BaseModel):
    label: str
    time: str


class RoutineTaskOut(BaseModel):
    id: str
    label: str
    time: str
    completed_date: str | None = None
    patient_id: str


class RoutineTaskUpdate(BaseModel):
    label: str | None = None
    time: str | None = None
    completed_date: str | None = None
