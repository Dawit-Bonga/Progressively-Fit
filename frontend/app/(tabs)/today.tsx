import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { apiRequest } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import type { RoutineDay, WorkoutSession } from "@/types/api";

type ExerciseDraft = {
  exercise_name: string;
  sets: string;
  reps: string;
  target_weight: string;
};

const emptyExercise = (): ExerciseDraft => ({
  exercise_name: "",
  sets: "3",
  reps: "10",
  target_weight: "",
});

export default function TodayScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { signOut } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [routineName, setRoutineName] = useState("");
  const [workoutName, setWorkoutName] = useState("");
  const [exercises, setExercises] = useState<ExerciseDraft[]>([
    emptyExercise(),
  ]);

  const routinesQuery = useQuery({
    queryKey: ["routine-days"],
    queryFn: () => apiRequest<RoutineDay[]>("/routines/days"),
  });

  const startWorkout = useMutation({
    mutationFn: (routineDayId: string) =>
      apiRequest<WorkoutSession>("/sessions", {
        method: "POST",
        body: { routine_day_id: routineDayId },
      }),
    onSuccess: (session) => {
      router.push({
        pathname: "/workout/[sessionId]",
        params: {
          sessionId: session.id,
          routineDayId: session.routine_day_id ?? "",
        },
      });
    },
    onError: (error: Error) => {
      Alert.alert("Could not start workout", error.message);
    },
  });

  const createRoutine = useMutation({
    mutationFn: () => {
      const validExercises = exercises.filter((exercise) =>
        exercise.exercise_name.trim(),
      );

      if (!routineName.trim() || !workoutName.trim()) {
        throw new Error("Add a routine name and workout name.");
      }
      if (!validExercises.length) {
        throw new Error("Add at least one exercise.");
      }

      return apiRequest("/routines", {
        method: "POST",
        body: {
          name: routineName.trim(),
          days: [
            {
              name: workoutName.trim(),
              day_of_week: new Date().getDay(),
              exercises: validExercises.map((exercise) => ({
                exercise_name: exercise.exercise_name.trim(),
                sets: Number(exercise.sets),
                reps: Number(exercise.reps),
                target_weight: Number(exercise.target_weight || 0),
              })),
            },
          ],
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["routine-days"] });
      setRoutineName("");
      setWorkoutName("");
      setExercises([emptyExercise()]);
      setIsCreateOpen(false);
    },
    onError: (error: Error) => {
      Alert.alert("Could not create workout", error.message);
    },
  });

  function updateExercise(
    index: number,
    field: keyof ExerciseDraft,
    value: string,
  ) {
    setExercises((current) =>
      current.map((exercise, exerciseIndex) =>
        exerciseIndex === index ? { ...exercise, [field]: value } : exercise,
      ),
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <FlatList
        contentContainerStyle={styles.content}
        data={routinesQuery.data ?? []}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          routinesQuery.isLoading ? (
            <ActivityIndicator color="#2563eb" size="large" />
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Build your first workout</Text>
              <Text style={styles.emptyText}>
                Add a saved workout such as Back & Biceps or Chest & Triceps.
              </Text>
            </View>
          )
        }
        ListHeaderComponent={
          <View>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.eyebrow}>TODAY</Text>
                <Text style={styles.title}>Ready to train?</Text>
              </View>
              <Pressable onPress={signOut}>
                <Text style={styles.signOut}>Sign out</Text>
              </Pressable>
            </View>
            <Text style={styles.subtitle}>
              Pick a saved workout or create a new one.
            </Text>
            <Pressable
              onPress={() => setIsCreateOpen(true)}
              style={styles.addButton}
            >
              <Text style={styles.addButtonText}>+ Add workout</Text>
            </Pressable>
            {routinesQuery.isError ? (
              <Pressable onPress={() => routinesQuery.refetch()}>
                <Text style={styles.errorText}>
                  Could not load workouts. Tap to retry.
                </Text>
              </Pressable>
            ) : null}
            <Text style={styles.sectionTitle}>Your workouts</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.workoutCard}>
            <View style={styles.cardTopRow}>
              <View style={styles.cardText}>
                <Text style={styles.workoutName}>
                  {item.name ?? item.routine_name}
                </Text>
                <Text style={styles.routineName}>{item.routine_name}</Text>
              </View>
              <View style={styles.exerciseCount}>
                <Text style={styles.exerciseCountText}>
                  {item.exercises.length}
                </Text>
              </View>
            </View>
            <Text numberOfLines={2} style={styles.exercisePreview}>
              {item.exercises
                .map(
                  (exercise) =>
                    `${exercise.exercise_name} ${exercise.sets}x${exercise.reps}${
                      Number(exercise.target_weight) > 0
                        ? ` @ ${exercise.target_weight}`
                        : ""
                    }`,
                )
                .join("  •  ")}
            </Text>
            <Pressable
              disabled={startWorkout.isPending}
              onPress={() => startWorkout.mutate(item.id)}
              style={styles.startButton}
            >
              <Text style={styles.startButtonText}>Start workout</Text>
            </Pressable>
          </View>
        )}
      />

      <Modal
        animationType="slide"
        onRequestClose={() => setIsCreateOpen(false)}
        presentationStyle="pageSheet"
        visible={isCreateOpen}
      >
        <SafeAreaView style={styles.modalPage}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New workout</Text>
            <Pressable onPress={() => setIsCreateOpen(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.label}>Routine</Text>
            <TextInput
              onChangeText={setRoutineName}
              placeholder="e.g. Push / Pull Split"
              placeholderTextColor="#64748b"
              style={styles.input}
              value={routineName}
            />
            <Text style={styles.label}>Workout name</Text>
            <TextInput
              onChangeText={setWorkoutName}
              placeholder="e.g. Back & Biceps"
              placeholderTextColor="#64748b"
              style={styles.input}
              value={workoutName}
            />

            <Text style={styles.exerciseHeading}>Exercises</Text>
            {exercises.map((exercise, index) => (
              <View key={index} style={styles.exerciseDraft}>
                <TextInput
                  onChangeText={(value) =>
                    updateExercise(index, "exercise_name", value)
                  }
                  placeholder="Exercise name"
                  placeholderTextColor="#64748b"
                  style={styles.input}
                  value={exercise.exercise_name}
                />
                <View style={styles.numberRow}>
                  <View style={styles.numberField}>
                    <Text style={styles.label}>Sets</Text>
                    <TextInput
                      keyboardType="number-pad"
                      onChangeText={(value) =>
                        updateExercise(index, "sets", value)
                      }
                      style={styles.input}
                      value={exercise.sets}
                    />
                  </View>
                  <View style={styles.numberField}>
                    <Text style={styles.label}>Reps</Text>
                    <TextInput
                      keyboardType="number-pad"
                      onChangeText={(value) =>
                        updateExercise(index, "reps", value)
                      }
                      style={styles.input}
                      value={exercise.reps}
                    />
                  </View>
                  <View style={styles.numberField}>
                    <Text style={styles.label}>Weight</Text>
                    <TextInput
                      keyboardType="decimal-pad"
                      onChangeText={(value) =>
                        updateExercise(index, "target_weight", value)
                      }
                      placeholder="e.g. 60"
                      placeholderTextColor="#64748b"
                      style={styles.input}
                      value={exercise.target_weight}
                    />
                  </View>
                </View>
              </View>
            ))}

            <Pressable
              onPress={() =>
                setExercises((current) => [...current, emptyExercise()])
              }
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>+ Add exercise</Text>
            </Pressable>
            <Pressable
              disabled={createRoutine.isPending}
              onPress={() => createRoutine.mutate()}
              style={styles.saveButton}
            >
              {createRoutine.isPending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveButtonText}>Save workout</Text>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: "#e8eef7", flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  eyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: { color: "#0f172a", fontSize: 30, fontWeight: "800", marginTop: 4 },
  subtitle: { color: "#475569", fontSize: 16, marginBottom: 18, marginTop: 8 },
  signOut: { color: "#334155", fontWeight: "700" },
  addButton: {
    alignItems: "center",
    backgroundColor: "#dbeafe",
    borderRadius: 14,
    paddingVertical: 14,
  },
  addButtonText: { color: "#1d4ed8", fontSize: 16, fontWeight: "700" },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 12,
    marginTop: 28,
  },
  workoutCard: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 14,
    padding: 18,
  },
  cardTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardText: { flex: 1 },
  workoutName: { color: "#0f172a", fontSize: 20, fontWeight: "800" },
  routineName: { color: "#475569", marginTop: 3 },
  exerciseCount: {
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  exerciseCountText: { color: "#2563eb", fontWeight: "800" },
  exercisePreview: {
    color: "#475569",
    lineHeight: 21,
    marginBottom: 16,
    marginTop: 14,
  },
  startButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 13,
  },
  startButtonText: { color: "#ffffff", fontWeight: "800" },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 20,
    borderStyle: "dashed",
    borderWidth: 1,
    padding: 24,
  },
  emptyTitle: { color: "#0f172a", fontSize: 18, fontWeight: "800" },
  emptyText: { color: "#475569", lineHeight: 21, marginTop: 6 },
  errorText: { color: "#dc2626", marginTop: 14, textAlign: "center" },
  modalPage: { backgroundColor: "#e8eef7", flex: 1 },
  modalHeader: {
    alignItems: "center",
    borderBottomColor: "#cbd5e1",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
  },
  modalTitle: { color: "#0f172a", fontSize: 22, fontWeight: "800" },
  cancelText: { color: "#2563eb", fontWeight: "700" },
  modalContent: { padding: 20, paddingBottom: 48 },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderColor: "#94a3b8",
    borderRadius: 12,
    borderWidth: 1,
    color: "#0f172a",
    fontSize: 16,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  exerciseHeading: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
    marginTop: 8,
  },
  exerciseDraft: {
    backgroundColor: "#dbe7f5",
    borderRadius: 16,
    marginBottom: 12,
    padding: 14,
  },
  numberRow: { flexDirection: "row", gap: 12 },
  numberField: { flex: 1 },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#2563eb",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 13,
  },
  secondaryButtonText: { color: "#2563eb", fontWeight: "700" },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 14,
    marginTop: 24,
    paddingVertical: 15,
  },
  saveButtonText: { color: "#ffffff", fontSize: 16, fontWeight: "800" },
});
