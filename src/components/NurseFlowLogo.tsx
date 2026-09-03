import { Image } from "expo-image";
import { StyleSheet } from "react-native";

type NurseFlowLogoVariant = "mark" | "wordmark";

type NurseFlowLogoProps = {
  accessibilityLabel?: string;
  variant: NurseFlowLogoVariant;
};

const logoSources = {
  mark: require("../../assets/images/nurseflow-mark.png"),
  wordmark: require("../../assets/images/nurseflow-logo.png"),
} as const;

export function NurseFlowLogo({
  accessibilityLabel,
  variant,
}: NurseFlowLogoProps) {
  return (
    <Image
      accessibilityLabel={accessibilityLabel}
      accessible={Boolean(accessibilityLabel)}
      contentFit="contain"
      source={logoSources[variant]}
      style={variant === "mark" ? styles.mark : styles.wordmark}
    />
  );
}

const styles = StyleSheet.create({
  mark: {
    height: 44,
    width: 38,
  },
  wordmark: {
    alignSelf: "center",
    height: 122,
    width: 160,
  },
});
