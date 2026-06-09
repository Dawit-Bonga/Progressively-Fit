import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ApiError, apiRequest } from "@/lib/api";
import type {
  LastSet,
  LoggedSet,
  RoutineDay,
  RoutineExercise,
} from "@/types/api";

type SetDraft = {
  weight: string;
  reps: string;
  isLogged: boolean;
};

function ExerciseLogger({
  exercise,
  sessionId,
}: {
  exercise: RoutineExercise;
  sessionId: string;
}) {
  const [sets, setSets] = useState<SetDraft[]>(
    Array.from({ length: exercise.sets }, () => ({
      weight:
        Number(exercise.target_weight) > 0 ? exercise.target_weight : "",
      reps: String(exercise.reps),
      isLogged: false,
    })),
  );

  const lastSetQuery = useQuery({
    queryKey: ["last-set", exercise.exercise_name],
    queryFn: async () => {
      try {
        return await apiRequest<LastSet>(
          `/sessions/last?exercise_name=${encodeURIComponent(
            exercise.exercise_name,
          )}`,
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
  });

  const logSet = useMutation({
    mutationFn: ({
      setIndex,
      draft,
    }: {
      setIndex: number;
      draft: SetDraft;
    }) =>
      apiRequest<LoggedSet>(`/sessions/${sessionId}/sets`, {
        method: "POST",
        body: {
          exercise_name: exercise.exercise_name,
          set_number: setIndex + 1,
          weight: Number(draft.weight),
          reps: Number(draft.reps),
          completed: true,
        },
      }),
    onSuccess: (_data, variables) => {
      setSets((current) =>
        current.map((set, index) =>
          index === variables.setIndex ? { ...set, isLogged: true } : set,
        ),
      );
    },
    onError: (error: Error) => {
      Alert.alert("Could not log set", error.message);
    },
  });

  function updateSet(
    setIndex: number,
    field: "weight" | "reps",
    value: string,
  ) {
    setSets((current) =>
      current.map((set, index) =>
        index === setIndex ? { ...set, [field]: value } : set,
      ),
    );
  }

  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <View>
          <Text style={styles.exerciseName}>{exercise.exercise_name}</Text>
          <Text style={styles.targetText}>
            Target: {exercise.sets} sets × {exercise.reps} reps
            {Number(exercise.target_weight) > 0
              ? ` @ ${exercise.target_weight}`
              : ""}
          </Text>
        </View>
      </View>
      {lastSetQuery.data ? (
        <View style={styles.lastSetPill}>
          <Text style={styles.lastSetText}>
            Last: {lastSetQuery.data.weight} × {lastSetQuery.data.reps}
          </Text>
        </View>
      ) : (
        <Text style={styles.noHistoryText}>No previous completed set yet</Text>
      )}

      <View style={styles.tableHeader}>
        <Text style={[styles.columnLabel, styles.setColumn]}>SET</Text>
        <Text style={styles.columnLabel}>WEIGHT</Text>
        <Text style={styles.columnLabel}>REPS</Text>
        <View style={styles.actionColumn} />
      </View>
      {sets.map((set, index) => (
        <View key={index} style={styles.setRow}>
          <Text style={[styles.setNumber, styles.setColumn]}>{index + 1}</Text>
          <TextInput
            editable={!set.isLogged}
            keyboardType="decimal-pad"
            onChangeText={(value) => updateSet(index, "weight", value)}
            placeholder={lastSetQuery.data?.weight ?? "0"}
            placeholderTextColor="#64748b"
            style={styles.setInput}
            value={set.weight}
          />
          <TextInput
            editable={!set.isLogged}
            keyboardType="number-pad"
            onChangeText={(value) => updateSet(index, "reps", value)}
            style={styles.setInput}
            value={set.reps}
          />
          <Pressable
            disabled={
              set.isLogged ||
              logSet.isPending ||
              !set.weight.trim() ||
              !set.reps.trim()
            }
            onPress={() => logSet.mutate({ setIndex: index, draft: set })}
            style={[
              styles.checkButton,
              set.isLogged && styles.checkButtonDone,
            ]}
          >
            <Text style={styles.checkText}>{set.isLogged ? "✓" : "Log"}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

export default function WorkoutScreen() {
  const { sessionId, routineDayId } = useLocalSearchParams<{
    sessionId: string;
    routineDayId: string;
  }>();

  const routineQuery = useQuery({
    queryKey: ["routine-day", routineDayId],
    queryFn: () =>
      apiRequest<RoutineDay>(`/routines/days/${routineDayId}`),
    enabled: Boolean(routineDayId),
  });

  if (routineQuery.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#2563eb" size="large" />
      </View>
    );
  }

  if (!routineQuery.data) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>Could not load this workout.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>IN PROGRESS</Text>
        <Text style={styles.title}>
          {routineQuery.data.name ?? routineQuery.data.routine_name}
        </Text>
        <Text style={styles.subtitle}>
          Log each completed set. Previous performance appears when available.
        </Text>

        {routineQuery.data.exercises.map((exercise) => (
          <ExerciseLogger
            exercise={exercise}
            key={exercise.id}
            sessionId={sessionId}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: "#e8eef7", flex: 1 },
  content: { padding: 20, paddingBottom: 48 },
  loading: {
    alignItems: "center",
    backgroundColor: "#e8eef7",
    flex: 1,
    justifyContent: "center",
  },
  eyebrow: {
    color: "#16a34a",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: { color: "#0f172a", fontSize: 30, fontWeight: "800", marginTop: 5 },
  subtitle: {
    color: "#475569",
    lineHeight: 21,
    marginBottom: 22,
    marginTop: 7,
  },
  exerciseCard: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  exerciseName: { color: "#0f172a", fontSize: 19, fontWeight: "800" },
  targetText: { color: "#475569", marginTop: 4 },
  lastSetPill: {
    alignSelf: "flex-start",
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  lastSetText: { color: "#1d4ed8", fontSize: 13, fontWeight: "700" },
  noHistoryText: { color: "#64748b", fontSize: 13, marginTop: 12 },
  tableHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  columnLabel: {
    color: "#64748b",
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  setColumn: { flex: 0, width: 32 },
  actionColumn: { width: 54 },
  setRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  setNumber: { color: "#475569", fontWeight: "800", textAlign: "center" },
  setInput: {
    backgroundColor: "#eef2f7",
    borderColor: "#94a3b8",
    borderRadius: 10,
    borderWidth: 1,
    color: "#0f172a",
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 10,
    textAlign: "center",
  },
  checkButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 11,
    width: 54,
  },
  checkButtonDone: { backgroundColor: "#16a34a" },
  checkText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  errorText: { color: "#dc2626" },
});
