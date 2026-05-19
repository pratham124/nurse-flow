import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radius, spacing, textSize } from "../../theme/tokens";
import { MinusIcon, PlusIcon } from "./Icons";

type PlaceholderInputProps = {
  label: string;
  placeholder: string;
  helperText?: string;
};

export function PlaceholderInput({
  label,
  placeholder,
  helperText,
}: PlaceholderInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRing, isFocused ? styles.focusedInputRing : null]}>
        <TextInput
          onBlur={() => setIsFocused(false)}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          placeholderTextColor={colors.neutral.textTertiary}
          style={[styles.input, isFocused ? styles.focusedInput : null]}
        />
      </View>
      {helperText ? <Text style={styles.fieldHelper}>{helperText}</Text> : null}
    </View>
  );
}

export function PlaceholderButton({ label }: { label: string }) {
  const isAddRoom = label === "Add room";

  return (
    <View
      style={[
        styles.secondaryButton,
        isAddRoom ? styles.addRoomButton : null,
      ]}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </View>
  );
}

export function NumberStepperPlaceholder({ value }: { value: string }) {
  return (
    <View style={styles.stepper}>
      <View style={styles.stepperButton}>
        <MinusIcon />
      </View>
      <Text style={styles.stepperValue}>{value}</Text>
      <View style={styles.stepperButton}>
        <PlusIcon />
      </View>
    </View>
  );
}

export function SegmentedPlaceholder({
  options,
  selectedIndex = 0,
}: {
  options: string[];
  selectedIndex?: number;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option, index) => {
        const isSelected = index === selectedIndex;

        return (
          <View
            key={option}
            style={[
              styles.segmentOption,
              isSelected ? styles.selectedSegmentOption : null,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                isSelected ? styles.selectedSegmentText : null,
              ]}
            >
              {option}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
  },
  inputRing: {
    borderRadius: 12,
    padding: 2,
  },
  focusedInputRing: {
    backgroundColor: colors.brand.burgundy12,
  },
  input: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  focusedInput: {
    borderColor: colors.brand.burgundy,
  },
  fieldHelper: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  addRoomButton: {
    borderColor: colors.brand.burgundy,
    borderWidth: 1,
  },
  secondaryButtonText: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.action,
  },
  stepper: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  stepperButton: {
    alignItems: "center",
    backgroundColor: colors.neutral.backgroundPrimary,
    borderColor: colors.neutral.borderSecondary,
    borderRadius: radius.sm,
    borderWidth: 0.5,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  stepperValue: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.action,
    fontWeight: "500",
    minWidth: 24,
    textAlign: "center",
  },
  segmented: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderRadius: 12,
    flexDirection: "row",
    gap: 3,
    overflow: "hidden",
    padding: 3,
  },
  segmentOption: {
    alignItems: "center",
    borderRadius: radius.md,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  selectedSegmentOption: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderSecondary,
    borderWidth: 0.5,
  },
  segmentText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.md,
    textAlign: "center",
  },
  selectedSegmentText: {
    color: colors.neutral.textPrimary,
    fontWeight: "500",
  },
});
