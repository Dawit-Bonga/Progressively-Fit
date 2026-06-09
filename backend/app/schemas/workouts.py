from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class StartSessionRequest(BaseModel):
    routine_day_id: UUID | None = None
    started_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=2000)


class WorkoutSessionResponse(BaseModel):
    id: UUID
    user_id: UUID
    routine_day_id: UUID | None
    started_at: datetime
    completed_at: datetime | None
    notes: str | None
    created_at: datetime


class LogSetRequest(BaseModel):
    exercise_name: str = Field(min_length=1, max_length=150)
    set_number: int = Field(ge=1, le=32767)
    weight: Decimal = Field(ge=0, max_digits=8, decimal_places=2)
    reps: int = Field(ge=0, le=32767)
    completed: bool = True

    @field_validator("exercise_name")
    @classmethod
    def normalize_exercise_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Exercise name cannot be blank.")
        return normalized


class SessionSetResponse(BaseModel):
    id: UUID
    workout_session_id: UUID
    exercise_name: str
    set_number: int
    weight: Decimal
    reps: int
    completed: bool
    created_at: datetime


class LastSetResponse(BaseModel):
    set_id: UUID
    session_id: UUID
    exercise_name: str
    set_number: int
    weight: Decimal
    reps: int
    session_started_at: datetime
