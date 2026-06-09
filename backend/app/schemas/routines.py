from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class CreateExerciseRequest(BaseModel):
    exercise_name: str = Field(min_length=1, max_length=150)
    sets: int = Field(ge=1, le=100)
    reps: int = Field(ge=1, le=1000)
    target_weight: Decimal = Field(
        default=Decimal("0"),
        ge=0,
        max_digits=8,
        decimal_places=2,
    )

    @field_validator("exercise_name")
    @classmethod
    def normalize_exercise_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Exercise name cannot be blank.")
        return normalized


class CreateRoutineDayRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    day_of_week: int = Field(ge=0, le=6)
    exercises: list[CreateExerciseRequest] = Field(min_length=1, max_length=30)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Workout name cannot be blank.")
        return normalized


class CreateRoutineRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=1000)
    days: list[CreateRoutineDayRequest] = Field(min_length=1, max_length=7)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Routine name cannot be blank.")
        return normalized


class RoutineExerciseResponse(BaseModel):
    id: UUID
    exercise_name: str
    sets: int
    reps: int
    target_weight: Decimal
    exercise_order: int


class RoutineDayResponse(BaseModel):
    id: UUID
    routine_id: UUID
    routine_name: str
    name: str | None
    day_of_week: int
    exercises: list[RoutineExerciseResponse]


class RoutineResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    days: list[RoutineDayResponse]
