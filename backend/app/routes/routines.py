from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from postgrest.exceptions import APIError
from supabase import Client
from supabase_auth.types import User

from app.database import get_supabase
from app.dependencies.auth import get_current_user
from app.schemas.routines import (
    CreateRoutineRequest,
    RoutineDayResponse,
    RoutineExerciseResponse,
    RoutineResponse,
)

router = APIRouter()

DAY_SELECT = (
    "id,routine_id,day_of_week,name,created_at,"
    "routines!inner(id,name,user_id),"
    "routine_exercises("
    "id,exercise_name,sets,reps,target_weight,exercise_order"
    ")"
)


def database_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="The routines database request failed.",
    )


def serialize_day(row: dict[str, object]) -> RoutineDayResponse:
    routine = row.get("routines")
    exercises = row.get("routine_exercises", [])

    if not isinstance(routine, dict) or not isinstance(exercises, list):
        raise database_error()

    ordered_exercises = sorted(
        exercises,
        key=lambda exercise: exercise.get("exercise_order", 0),
    )

    return RoutineDayResponse(
        id=row["id"],
        routine_id=row["routine_id"],
        routine_name=routine["name"],
        name=row.get("name"),
        day_of_week=row["day_of_week"],
        exercises=[
            RoutineExerciseResponse.model_validate(exercise)
            for exercise in ordered_exercises
        ],
    )


def fetch_owned_day(
    supabase: Client,
    routine_day_id: UUID,
    user_id: str,
) -> dict[str, object] | None:
    response = (
        supabase.table("routine_days")
        .select(DAY_SELECT)
        .eq("id", str(routine_day_id))
        .eq("routines.user_id", user_id)
        .limit(1)
        .execute()
    )
    return response.data[0] if response.data else None


@router.get("/days", response_model=list[RoutineDayResponse])
def list_routine_days(
    current_user: Annotated[User, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> list[RoutineDayResponse]:
    try:
        response = (
            supabase.table("routine_days")
            .select(DAY_SELECT)
            .eq("routines.user_id", str(current_user.id))
            .order("created_at", desc=False)
            .execute()
        )
    except APIError as error:
        raise database_error() from error

    return [serialize_day(row) for row in response.data]


@router.get("/days/{routine_day_id}", response_model=RoutineDayResponse)
def get_routine_day(
    routine_day_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> RoutineDayResponse:
    try:
        row = fetch_owned_day(
            supabase,
            routine_day_id,
            str(current_user.id),
        )
    except APIError as error:
        raise database_error() from error

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Routine day not found.",
        )

    return serialize_day(row)


@router.post(
    "",
    response_model=RoutineResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_routine(
    payload: CreateRoutineRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> RoutineResponse:
    routine_id: str | None = None

    try:
        routine_response = (
            supabase.table("routines")
            .insert(
                {
                    "user_id": str(current_user.id),
                    "name": payload.name,
                    "description": payload.description,
                }
            )
            .execute()
        )
        if not routine_response.data:
            raise database_error()

        routine_row = routine_response.data[0]
        routine_id = routine_row["id"]
        created_days: list[RoutineDayResponse] = []

        for day in payload.days:
            day_response = (
                supabase.table("routine_days")
                .insert(
                    {
                        "routine_id": routine_id,
                        "day_of_week": day.day_of_week,
                        "name": day.name,
                    }
                )
                .execute()
            )
            if not day_response.data:
                raise database_error()

            day_id = day_response.data[0]["id"]
            exercise_rows = [
                {
                    "routine_day_id": day_id,
                    "exercise_name": exercise.exercise_name,
                    "sets": exercise.sets,
                    "reps": exercise.reps,
                    "target_weight": str(exercise.target_weight),
                    "exercise_order": index,
                }
                for index, exercise in enumerate(day.exercises)
            ]
            exercises_response = (
                supabase.table("routine_exercises")
                .insert(exercise_rows)
                .execute()
            )
            if len(exercises_response.data) != len(day.exercises):
                raise database_error()

            created_days.append(
                RoutineDayResponse(
                    id=day_id,
                    routine_id=routine_id,
                    routine_name=routine_row["name"],
                    name=day.name,
                    day_of_week=day.day_of_week,
                    exercises=[
                        RoutineExerciseResponse.model_validate(row)
                        for row in sorted(
                            exercises_response.data,
                            key=lambda exercise: exercise["exercise_order"],
                        )
                    ],
                )
            )
    except HTTPException:
        if routine_id:
            supabase.table("routines").delete().eq("id", routine_id).execute()
        raise
    except APIError as error:
        if routine_id:
            try:
                supabase.table("routines").delete().eq("id", routine_id).execute()
            except APIError:
                pass
        raise database_error() from error

    return RoutineResponse(
        id=routine_id,
        name=routine_row["name"],
        description=routine_row.get("description"),
        days=created_days,
    )
