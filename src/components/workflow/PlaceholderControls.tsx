import { ReactNode, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from "react-native";

import { colors, radius, spacing, textSize } from "../../theme/tokens";
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
      style={[
        styles.secondaryButton,
        isPrimary ? styles.primaryButton : null,
        !onPress ? styles.disabledButton : null,
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
        style={styles.stepperButton}
      >
        <MinusIcon />
      </Pressable>
      <Text style={styles.stepperValue}>{value}</Text>
      <Pressable
        accessibilityLabel={incrementLabel}
        accessibilityRole="button"
        disabled={!onIncrement}
        onPress={onIncrement}
        style={styles.stepperButton}
      >
        <PlusIcon />
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
    borderRadius: radius.lg,
    borderWidth: 0.5,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  primaryButton: {
    alignSelf: "flex-end",
    backgroundColor: colors.brand.burgundy,
    borderColor: colors.brand.burgundy,
    borderRadius: radius.md,
    minHeight: 40,
    paddingHorizontal: spacing.lg,
  },
  disabledButton: {
    opacity: 0.48,
  },
  buttonIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.action,
  },
  primaryButtonText: {
    color: colors.neutral.surface,
    fontWeight: "500",
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
