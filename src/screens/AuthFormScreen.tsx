import { useState } from "react";
import { router } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LoadingState } from "../components/LoadingState";
import { loginWithEmail, signUpWithEmail } from "../services/authRepository";
import { useAuthSession } from "../store/AuthSessionContext";
import {
  colors,
  fontWeight,
  radius,
  spacing,
  textSize,
} from "../theme/tokens";

type AuthMode = "login" | "signup";

type AuthFormScreenProps = {
  mode: AuthMode;
};

type AuthFieldProps = {
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?: "email" | "name" | "password" | "new-password";
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  value: string;
};

function AuthField({
  autoCapitalize = "none",
  autoComplete,
  label,
  onChangeText,
  placeholder,
  secureTextEntry,
  value,
}: AuthFieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.neutral.textTertiary}
        secureTextEntry={secureTextEntry}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function getCleanEmail(email: string) {
  return email.trim().toLowerCase();
}

function getValidationMessage({
  displayName,
  email,
  mode,
  password,
}: {
  displayName: string;
  email: string;
  mode: AuthMode;
  password: string;
}) {
  if (mode === "signup" && !displayName.trim()) {
    return "Enter your display name.";
  }

  if (!getCleanEmail(email)) {
    return "Enter your email.";
  }

  if (!getCleanEmail(email).includes("@")) {
    return "Enter a valid email address.";
  }

  if (!password) {
    return "Enter your password.";
  }

  if (mode === "signup" && password.length < 6) {
    return "Use a password with at least 6 characters.";
  }

  return "";
}

export default function AuthFormScreen({ mode }: AuthFormScreenProps) {
  const { refreshSession } = useAuthSession();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSignup = mode === "signup";

  async function handleSubmit() {
    const validationMessage = getValidationMessage({
      displayName,
      email,
      mode,
      password,
    });

    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      if (isSignup) {
        await signUpWithEmail({
          displayName: displayName.trim(),
          email: getCleanEmail(email),
          password,
        });
      } else {
        await loginWithEmail({
          email: getCleanEmail(email),
          password,
        });
      }

      await refreshSession();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The account request could not be completed.";

      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <Text style={styles.brandMarkText}>NF</Text>
              </View>
              <Text style={styles.brand}>NurseFlow</Text>
            </View>
            <Text style={styles.title}>
              {isSignup ? "Create account" : "Welcome back"}
            </Text>
          </View>

          <View style={styles.formPanel}>
            <View style={styles.fieldPanel}>
              {isSignup ? (
                <AuthField
                  autoCapitalize="words"
                  autoComplete="name"
                  label="Display name"
                  onChangeText={setDisplayName}
                  placeholder="Jamie Charge"
                  value={displayName}
                />
              ) : null}

              <AuthField
                autoComplete="email"
                label="Email"
                onChangeText={setEmail}
                placeholder="name@example.com"
                value={email}
              />
              <AuthField
                autoComplete={isSignup ? "new-password" : "password"}
                label="Password"
                onChangeText={setPassword}
                placeholder={isSignup ? "At least 6 characters" : "Password"}
                secureTextEntry
                value={password}
              />
            </View>

            {errorMessage ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                {errorMessage}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={handleSubmit}
              style={({ pressed }) => [
                styles.primaryButton,
                (pressed || isSubmitting) && styles.primaryButtonPressed,
              ]}
            >
              {isSubmitting ? (
                <LoadingState
                  color={colors.neutral.surface}
                  message={isSignup ? "Creating account" : "Signing in"}
                  showMessage={false}
                  variant="inline"
                />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isSignup ? "Create account" : "Sign in"}
                </Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace(isSignup ? "/login" : "/signup")}
              style={({ pressed }) => [
                styles.switchButton,
                pressed && styles.switchButtonPressed,
              ]}
            >
              <Text style={styles.switchText}>
                {isSignup ? "Already have an account?" : "New to NurseFlow?"}{" "}
                <Text style={styles.switchLink}>
                  {isSignup ? "Sign in" : "Create account"}
                </Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.neutral.backgroundPrimary,
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: "flex-start",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.xxl + spacing.xl,
  },
  header: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: colors.brand.burgundy,
    borderRadius: radius.md,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  brandMarkText: {
    color: colors.neutral.surface,
    fontSize: textSize.sm,
    fontWeight: fontWeight.heavy,
  },
  brand: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.semibold,
  },
  title: {
    color: colors.neutral.textPrimary,
    fontSize: 34,
    fontWeight: fontWeight.heavy,
    lineHeight: 40,
  },
  formPanel: {
    gap: spacing.lg,
  },
  fieldPanel: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xxl,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 6,
        blurRadius: 16,
        color: "rgba(33, 26, 29, 0.06)",
      },
    ],
  },
  fieldGroup: {
    gap: spacing.sm,
  },
  fieldLabel: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.bold,
  },
  input: {
    backgroundColor: colors.neutral.backgroundTertiary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 1,
    color: colors.neutral.textPrimary,
    fontSize: textSize.action,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  errorText: {
    color: colors.status.red700,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.brand.burgundy,
    borderRadius: radius.xl,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  primaryButtonPressed: {
    opacity: 0.82,
  },
  primaryButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
  switchButton: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: radius.pill,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  switchButtonPressed: {
    backgroundColor: colors.neutral.backgroundSecondary,
  },
  switchText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.action,
    fontWeight: fontWeight.medium,
  },
  switchLink: {
    color: colors.brand.burgundy,
    fontSize: textSize.action,
    fontWeight: fontWeight.bold,
  },
});
