export type RoutineExercise = {
  id: string;
  exercise_name: string;
  sets: number;
  reps: number;
  target_weight: string;
  exercise_order: number;
};

export type RoutineDay = {
  id: string;
  routine_id: string;
  routine_name: string;
  name: string | null;
  day_of_week: number;
  exercises: RoutineExercise[];
};

export type WorkoutSession = {
  id: string;
  user_id: string;
  routine_day_id: string | null;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
};

export type LoggedSet = {
  id: string;
  workout_session_id: string;
  exercise_name: string;
  set_number: number;
  weight: string;
  reps: number;
  completed: boolean;
  created_at: string;
};

export type LastSet = {
  set_id: string;
  session_id: string;
  exercise_name: string;
  set_number: number;
  weight: string;
  reps: number;
  session_started_at: string;
};
