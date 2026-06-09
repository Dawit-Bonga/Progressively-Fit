from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from postgrest.exceptions import APIError
from supabase import Client
from supabase_auth.types import User

from app.database import get_supabase
from app.dependencies.auth import get_current_user
from app.schemas.workouts import (
    LastSetResponse,
    LogSetRequest,
    SessionSetResponse,
    StartSessionRequest,
    WorkoutSessionResponse,
)

router = APIRouter()


def database_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="The workout database request failed.",
    )


def first_row(data: list[dict[str, object]]) -> dict[str, object] | None:
    return data[0] if data else None


def user_owns_routine_day(
    supabase: Client,
    routine_day_id: UUID,
    user_id: str,
) -> bool:
    response = (
        supabase.table("routine_days")
        .select("id,routines!inner(user_id)")
        .eq("id", str(routine_day_id))
        .eq("routines.user_id", user_id)
        .limit(1)
        .execute()
    )
    return bool(response.data)


def user_owns_session(
    supabase: Client,
    session_id: UUID,
    user_id: str,
) -> bool:
    response = (
        supabase.table("workout_sessions")
        .select("id")
        .eq("id", str(session_id))
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return bool(response.data)


@router.post(
    "",
    response_model=WorkoutSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def start_session(
    payload: StartSessionRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> WorkoutSessionResponse:
    user_id = str(current_user.id)

    try:
        if payload.routine_day_id and not user_owns_routine_day(
            supabase,
            payload.routine_day_id,
            user_id,
        ):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Routine day not found.",
            )

        session_data: dict[str, object] = {
            "user_id": user_id,
            "routine_day_id": (
                str(payload.routine_day_id) if payload.routine_day_id else None
            ),
            "notes": payload.notes,
        }
        if payload.started_at:
            session_data["started_at"] = payload.started_at.isoformat()

        response = (
            supabase.table("workout_sessions")
            .insert(session_data)
            .execute()
        )
    except HTTPException:
        raise
    except APIError as error:
        raise database_error() from error

    row = first_row(response.data)
    if row is None:
        raise database_error()

    return WorkoutSessionResponse.model_validate(row)


@router.post(
    "/{session_id}/sets",
    response_model=SessionSetResponse,
    status_code=status.HTTP_201_CREATED,
)
def log_set(
    session_id: UUID,
    payload: LogSetRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SessionSetResponse:
    try:
        if not user_owns_session(supabase, session_id, str(current_user.id)):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workout session not found.",
            )

        response = (
            supabase.table("session_sets")
            .insert(
                {
                    "workout_session_id": str(session_id),
                    "exercise_name": payload.exercise_name,
                    "set_number": payload.set_number,
                    "weight": str(payload.weight),
                    "reps": payload.reps,
                    "completed": payload.completed,
                }
            )
            .execute()
        )
    except HTTPException:
        raise
    except APIError as error:
        if error.code == "23505":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "That set number is already logged for this exercise "
                    "in this session."
                ),
            ) from error
        raise database_error() from error

    row = first_row(response.data)
    if row is None:
        raise database_error()

    return SessionSetResponse.model_validate(row)


@router.get("/last", response_model=LastSetResponse)
def get_last_set(
    current_user: Annotated[User, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase)],
    exercise_name: Annotated[
        str,
        Query(min_length=1, max_length=150),
    ],
) -> LastSetResponse:
    normalized_name = exercise_name.strip()
    if not normalized_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Exercise name cannot be blank.",
        )

    try:
        response = (
            supabase.table("session_sets")
            .select(
                "id,workout_session_id,exercise_name,set_number,weight,reps,"
                "created_at,workout_sessions!inner(user_id,started_at)"
            )
            .eq("exercise_name", normalized_name)
            .eq("completed", True)
            .eq("workout_sessions.user_id", str(current_user.id))
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
    except APIError as error:
        raise database_error() from error

    row = first_row(response.data)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No completed sets found for this exercise.",
        )

    workout_session = row.get("workout_sessions")
    if not isinstance(workout_session, dict):
        raise database_error()

    return LastSetResponse(
        set_id=row["id"],
        session_id=row["workout_session_id"],
        exercise_name=row["exercise_name"],
        set_number=row["set_number"],
        weight=row["weight"],
        reps=row["reps"],
        session_started_at=workout_session["started_at"],
    )
