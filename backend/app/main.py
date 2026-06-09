from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes import auth, reminders, routines, workouts

settings = get_settings()

app = FastAPI(
    title="Progressively Fit API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(routines.router, prefix="/routines", tags=["routines"])
app.include_router(workouts.router, prefix="/sessions", tags=["sessions"])
app.include_router(reminders.router, prefix="/reminders", tags=["reminders"])


@app.get("/")
async def hello_world() -> dict[str, str]:
    return {"message": "Hello from Progressively Fit"}
