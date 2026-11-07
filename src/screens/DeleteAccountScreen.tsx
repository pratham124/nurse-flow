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
import { signOutCurrentSession } from "../services/authRepository";
import { deleteAccount } from "../services/profileRepository";
import { getSupabaseClient } from "../services/supabaseClient";
import {
  colors,
  fontWeight,
  radius,
  spacing,
  textSize,
} from "../theme/tokens";

const CONFIRMATION_WORD = "DELETE";

const deletedItems = [
  "Your login and profile",
  "Your floor templates",
  "Your active and previous shifts. Nurses who joined your active shift lose access immediately.",
  "Assignment runs and manual moves",
  "Invite codes",
  "Every message you wrote",
];

export default function DeleteAccountScreen() {
  const [confirmation, setConfirmation] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  // The match is exact and case-sensitive on purpose.
  const canDelete = confirmation === CONFIRMATION_WORD && !isDeleting;

  async function handleDelete() {
    if (!canDelete) {
      return;
    }

    setErrorMessage("");
    setIsDeleting(true);

    try {
      const supabase = getSupabaseClient();

      if (!supabase) {
        throw new Error("Supabase is not configured yet.");
      }

      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        throw new Error("Your session expired. Sign in again.");
      }

      await deleteAccount(data.session.access_token);
      // The server already removed the login, so only this device's saved
      // session is left to clear. The auth listener then signs the app out.
      await signOutCurrentSession();
      router.replace("/login");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The account could not be deleted. Try again.",
      );
      setIsDeleting(false);
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
          <Text accessibilityRole="header" style={styles.title}>
            Delete account
          </Text>

          <View style={styles.warningPanel}>
            <Text style={styles.warningTitle}>This permanently deletes:</Text>
            {deletedItems.map((item) => (
              <Text key={item} style={styles.warningItem}>
                {"•"} {item}
              </Text>
            ))}
            <Text style={styles.warningNote}>
              Shifts you joined keep your slot, but it is no longer linked to
              you. This cannot be undone.
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Type {CONFIRMATION_WORD} to confirm
            </Text>
            <TextInput
              accessibilityLabel={`Type ${CONFIRMATION_WORD} to confirm account deletion`}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!isDeleting}
              onChangeText={setConfirmation}
              placeholder={CONFIRMATION_WORD}
              placeholderTextColor={colors.neutral.textTertiary}
              style={styles.input}
              value={confirmation}
            />
          </View>

          {errorMessage ? (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {errorMessage}
            </Text>
          ) : null}

          <Pressable
            accessibilityLabel="Delete my account permanently"
            accessibilityRole="button"
            accessibilityState={{ busy: isDeleting, disabled: !canDelete }}
            disabled={!canDelete}
            onPress={handleDelete}
            style={({ pressed }) => [
              styles.deleteButton,
              (pressed || !canDelete) && styles.deleteButtonMuted,
            ]}
          >
            {isDeleting ? (
              <LoadingState
                color={colors.neutral.surface}
                message="Deleting account"
                showMessage={false}
                variant="inline"
              />
            ) : (
              <Text style={styles.deleteButtonText}>Delete my account</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityLabel="Cancel and go back"
            accessibilityRole="button"
            disabled={isDeleting}
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && styles.cancelButtonPressed,
            ]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
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
    gap: spacing.lg,
    justifyContent: "center",
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  title: {
    color: colors.neutral.textPrimary,
    fontSize: 34,
    fontWeight: fontWeight.heavy,
    lineHeight: 40,
  },
  warningPanel: {
    backgroundColor: colors.status.red50,
    borderRadius: radius.xxl,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  warningTitle: {
    color: colors.status.red800,
    fontSize: textSize.action,
    fontWeight: fontWeight.bold,
  },
  warningItem: {
    color: colors.status.red800,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  warningNote: {
    color: colors.status.red800,
    fontSize: textSize.sm,
    fontWeight: fontWeight.bold,
    lineHeight: 18,
    marginTop: spacing.sm,
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
    textAlign: "center",
  },
  deleteButton: {
    alignItems: "center",
    backgroundColor: colors.status.red700,
    borderRadius: radius.xl,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  deleteButtonMuted: {
    opacity: 0.5,
  },
  deleteButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
  cancelButton: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: radius.pill,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  cancelButtonPressed: {
    backgroundColor: colors.neutral.backgroundSecondary,
  },
  cancelText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.action,
    fontWeight: fontWeight.medium,
  },
});
