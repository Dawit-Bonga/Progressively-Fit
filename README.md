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

The initial database schema, indexes, Auth user trigger, and row-level security
policies are in:

```text
supabase/migrations/202606090001_initial_schema.sql
```

Apply it with the Supabase CLI:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Alternatively, run the migration in the Supabase SQL editor. Weekdays use
`0` through `6`, where `0` is Sunday.
