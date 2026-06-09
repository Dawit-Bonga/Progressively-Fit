import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const [isSignup, setIsSignup] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    if (!email.trim() || password.length < 8) {
      Alert.alert("Check your details", "Use a valid email and 8+ character password.");
      return;
    }

    setIsSubmitting(true);
    const result = isSignup
      ? await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() || undefined },
          },
        })
      : await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
    setIsSubmitting(false);

    if (result.error) {
      Alert.alert("Authentication failed", result.error.message);
      return;
    }

    if (isSignup && !result.data.session) {
      Alert.alert(
        "Check your email",
        "Confirm your email address, then return here and sign in.",
      );
      setIsSignup(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.page}
    >
      <View style={styles.card}>
        <Text style={styles.eyebrow}>PROGRESSIVELY FIT</Text>
        <Text style={styles.title}>
          {isSignup ? "Create your account" : "Welcome back"}
        </Text>
        <Text style={styles.subtitle}>
          Save routines, log every set, and build on your last workout.
        </Text>

        {isSignup ? (
          <TextInput
            autoCapitalize="words"
            onChangeText={setDisplayName}
            placeholder="Name"
            placeholderTextColor="#64748b"
            style={styles.input}
            value={displayName}
          />
        ) : null}
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor="#64748b"
          style={styles.input}
          value={email}
        />
        <TextInput
          autoCapitalize="none"
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor="#64748b"
          secureTextEntry
          style={styles.input}
          value={password}
        />

        <Pressable
          disabled={isSubmitting}
          onPress={submit}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {isSignup ? "Create account" : "Sign in"}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => setIsSignup((value) => !value)}>
          <Text style={styles.switchText}>
            {isSignup
              ? "Already have an account? Sign in"
              : "New here? Create an account"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#dbe7f5",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
  },
  eyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: {
    color: "#0f172a",
    fontSize: 30,
    fontWeight: "800",
    marginTop: 10,
  },
  subtitle: {
    color: "#475569",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
    marginTop: 8,
  },
  input: {
    backgroundColor: "#eef2f7",
    borderColor: "#94a3b8",
    borderRadius: 14,
    borderWidth: 1,
    color: "#0f172a",
    fontSize: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 14,
    marginTop: 4,
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  switchText: {
    color: "#2563eb",
    fontWeight: "600",
    marginTop: 20,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.8,
  },
});
