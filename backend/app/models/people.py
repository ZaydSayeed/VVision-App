from pydantic import BaseModel


class Interaction(BaseModel):
    timestamp: str
    summary: str


class PersonOut(BaseModel):
    id: str
    name: str
    relation: str = ""
    last_seen: str | None = None
    seen_count: int = 0
    notes: str = ""
    interactions: list[Interaction] = []


class PersonUpdate(BaseModel):
    relation: str | None = None
    notes: str | None = None


class NotesUpdate(BaseModel):
    notes: str
