import { StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radius, spacing, textSize } from "../../theme/tokens";

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
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        editable={false}
        placeholder={placeholder}
        placeholderTextColor={colors.neutral.mutedText}
        style={styles.input}
      />
      {helperText ? <Text style={styles.fieldHelper}>{helperText}</Text> : null}
    </View>
  );
}

export function PlaceholderButton({ label }: { label: string }) {
  return (
    <View style={styles.secondaryButton}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </View>
  );
}

export function NumberStepperPlaceholder({ value }: { value: string }) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperButton}>-</Text>
      <Text style={styles.stepperValue}>{value}</Text>
      <Text style={styles.stepperButton}>+</Text>
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
    color: colors.neutral.text,
    fontSize: textSize.sm,
    fontWeight: "700",
  },
  input: {
    backgroundColor: colors.neutral.background,
    borderColor: colors.neutral.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.neutral.text,
    fontSize: textSize.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  fieldHelper: {
    color: colors.neutral.mutedText,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.brand.burgundy,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    color: colors.brand.burgundy,
    fontSize: textSize.md,
    fontWeight: "700",
  },
  stepper: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  stepperButton: {
    backgroundColor: colors.neutral.background,
    borderColor: colors.neutral.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.brand.burgundy,
    fontSize: textSize.lg,
    fontWeight: "700",
    minHeight: 44,
    minWidth: 44,
    overflow: "hidden",
    textAlign: "center",
    textAlignVertical: "center",
  },
  stepperValue: {
    color: colors.neutral.text,
    fontSize: textSize.md,
    fontWeight: "700",
    minWidth: 24,
    textAlign: "center",
  },
  segmented: {
    borderColor: colors.neutral.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  segmentOption: {
    alignItems: "center",
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  selectedSegmentOption: {
    backgroundColor: colors.brand.lavender,
  },
  segmentText: {
    color: colors.neutral.mutedText,
    fontSize: textSize.sm,
    fontWeight: "700",
    textAlign: "center",
  },
  selectedSegmentText: {
    color: colors.neutral.text,
  },
});
