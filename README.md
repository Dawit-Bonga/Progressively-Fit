# Progressively Fit

Progressively Fit is a mobile gym tracking app built with an Expo/React Native
frontend and a FastAPI backend.

## Project Structure

```text
.
├── frontend/   # Expo Router application
└── backend/    # FastAPI application
```

## Backend Setup

1. Create and activate a virtual environment:

   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Create the local environment file:

   ```bash
   cp .env.example .env
   ```

4. Add your Supabase project values to `.env`.

5. Start the API:

   ```bash
   uvicorn app.main:app --reload
   ```

The hello-world endpoint is available at `http://localhost:8000/`. Interactive
API documentation is available at `http://localhost:8000/docs`.

### Authentication Endpoints

- `POST /auth/signup` creates an email/password user.
- `POST /auth/login` returns the user's access and refresh tokens.
- `GET /auth/me` demonstrates a protected route.

Send the login access token to protected routes:

```text
Authorization: Bearer YOUR_ACCESS_TOKEN
```

Other routes can use the same dependency:

```python
from typing import Annotated

from fastapi import Depends
from supabase_auth.types import User

from app.dependencies.auth import get_current_user


def protected_route(
    current_user: Annotated[User, Depends(get_current_user)],
):
    return {"user_id": current_user.id}
```

### Workout Logging Endpoints

All workout endpoints require an access token in the `Authorization` header.

- `POST /sessions` starts a workout session.
- `POST /sessions/{session_id}/sets` logs a completed set.
- `GET /sessions/last?exercise_name=Bench%20Press` returns the user's most
  recently completed matching set.

## Frontend Setup

1. Install dependencies:

   ```bash
   cd frontend
   npm install
   npx expo install --fix
   ```

2. Create the local environment file:

   ```bash
   cp .env.example .env
   ```

3. Add your public Supabase project values to `.env`.

4. Start Expo:

   ```bash
   npm start
   ```

Use `npm run ios`, `npm run android`, or the Expo development server controls
to launch the app on a device or simulator.

## Environment Notes

- Frontend variables must use Expo's `EXPO_PUBLIC_` prefix.
- Never place the Supabase service-role key in the frontend.
- The backend service-role key must remain server-side and must not be committed.

## Database Setup

Database schema changes, indexes, Auth triggers, and row-level security
policies are stored in:

```text
supabase/migrations/
```

Apply it with the Supabase CLI:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Alternatively, run the migration in the Supabase SQL editor. Weekdays use
`0` through `6`, where `0` is Sunday.

If the initial schema was already applied, also run
`202606090002_add_routine_exercise_weight.sql` to add saved target weights.
