import { ReactNode, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from "react-native";

import { colors, radius, spacing, textSize, fontWeight, shadows } from "../../theme/tokens";
import { MinusIcon, PlusIcon } from "./Icons";

type PlaceholderInputProps = {
  label: string;
  placeholder: string;
  helperText?: string;
  errorText?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  keyboardType?: KeyboardTypeOptions;
};

type PlaceholderButtonProps = {
  icon?: ReactNode;
  label: string;
  onPress?: () => void;
  variant?: "secondary" | "primary";
};

type NumberStepperPlaceholderProps = {
  value: string;
  onDecrement?: () => void;
  onIncrement?: () => void;
  decrementLabel?: string;
  incrementLabel?: string;
};

type SegmentedPlaceholderProps = {
  options: string[];
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
};

export function PlaceholderInput({
  label,
  placeholder,
  helperText,
  errorText,
  value,
  onChangeText,
  keyboardType,
}: PlaceholderInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const hasError = Boolean(errorText);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRing, isFocused ? styles.focusedInputRing : null]}>
        <TextInput
          onBlur={() => setIsFocused(false)}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={colors.neutral.textTertiary}
          style={[
            styles.input,
            isFocused ? styles.focusedInput : null,
            hasError ? styles.errorInput : null,
          ]}
          value={value}
        />
      </View>
      {errorText ? (
        <Text style={styles.fieldError}>{errorText}</Text>
      ) : helperText ? (
        <Text style={styles.fieldHelper}>{helperText}</Text>
      ) : null}
    </View>
  );
}

export function PlaceholderButton({
  icon,
  label,
  onPress,
  variant = "secondary",
}: PlaceholderButtonProps) {
  const isPrimary = variant === "primary";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !onPress }}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        isPrimary ? styles.primaryButton : styles.secondaryButton,
        !onPress ? styles.disabledButton : null,
        pressed && onPress ? styles.buttonPressed : null,
      ]}
    >
      {icon ? <View style={styles.buttonIcon}>{icon}</View> : null}
      <Text
        style={[
          styles.secondaryButtonText,
          isPrimary ? styles.primaryButtonText : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function NumberStepperPlaceholder({
  value,
  onDecrement,
  onIncrement,
  decrementLabel = "Decrease value",
  incrementLabel = "Increase value",
}: NumberStepperPlaceholderProps) {
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityLabel={decrementLabel}
        accessibilityRole="button"
        disabled={!onDecrement}
        onPress={onDecrement}
        style={({ pressed }) => [
          styles.stepperButton,
          !onDecrement ? styles.disabledButton : null,
          pressed && onDecrement ? styles.stepperButtonPressed : null,
        ]}
      >
        <MinusIcon color={onDecrement ? colors.brand.burgundy : colors.neutral.textTertiary} size={10} />
      </Pressable>
      <Text style={styles.stepperValue}>{value}</Text>
      <Pressable
        accessibilityLabel={incrementLabel}
        accessibilityRole="button"
        disabled={!onIncrement}
        onPress={onIncrement}
        style={({ pressed }) => [
          styles.stepperButton,
          !onIncrement ? styles.disabledButton : null,
          pressed && onIncrement ? styles.stepperButtonPressed : null,
        ]}
      >
        <PlusIcon color={onIncrement ? colors.brand.burgundy : colors.neutral.textTertiary} size={10} />
      </Pressable>
    </View>
  );
}

export function SegmentedPlaceholder({
  options,
  selectedIndex = 0,
  onSelect,
}: SegmentedPlaceholderProps) {
  return (
    <View style={styles.segmented}>
      {options.map((option, index) => {
        const isSelected = index === selectedIndex;

        return (
          <Pressable
            key={`${option}-${index}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            disabled={!onSelect}
            onPress={() => onSelect?.(index)}
            style={({ pressed }) => [
              styles.segmentOption,
              isSelected ? styles.selectedSegmentOption : null,
              pressed && onSelect ? styles.segmentOptionPressed : null,
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
          </Pressable>
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
    fontWeight: fontWeight.medium,
  },
  inputRing: {
    borderRadius: 14,
    padding: 2,
  },
  focusedInputRing: {
    backgroundColor: colors.brand.burgundy12,
    ...shadows.sm,
  },
  input: {
    backgroundColor: colors.neutral.surface,
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
  errorInput: {
    borderColor: colors.status.red700,
  },
  fieldHelper: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  fieldError: {
    color: colors.status.red700,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.neutral.borderTertiary,
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    ...shadows.sm,
  },
  primaryButton: {
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: colors.brand.burgundy,
    borderColor: colors.brand.burgundy,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    ...shadows.sm,
  },
  disabledButton: {
    opacity: 0.48,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.action,
    fontWeight: fontWeight.medium,
  },
  primaryButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
  stepper: {
    alignItems: "center",
    flexDirection: "row",
    backgroundColor: colors.neutral.backgroundSecondary,
    borderRadius: radius.pill,
    padding: 3,
    borderWidth: 0.5,
    borderColor: colors.neutral.borderTertiary,
  },
  stepperButton: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.pill,
    height: 28,
    width: 28,
    justifyContent: "center",
    ...shadows.sm,
  },
  stepperButtonPressed: {
    backgroundColor: colors.neutral.backgroundTertiary,
    opacity: 0.85,
  },
  stepperValue: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
    minWidth: 32,
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
  segmentOptionPressed: {
    opacity: 0.8,
  },
  selectedSegmentOption: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderSecondary,
    borderWidth: 0.5,
    ...shadows.sm,
  },
  segmentText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.md,
    textAlign: "center",
  },
  selectedSegmentText: {
    color: colors.neutral.textPrimary,
    fontWeight: fontWeight.semibold,
  },
});

