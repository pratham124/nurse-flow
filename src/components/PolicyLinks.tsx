import { openBrowserAsync } from "expo-web-browser";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { policyLinks } from "../config/policyLinks";
import { colors, fontWeight, spacing, textSize } from "../theme/tokens";

type PolicyLinkTextProps = {
  label: string;
  url: string;
};

// Opens in the in-app browser on a phone and in a new tab on web.
function openPolicyPage(url: string) {
  void openBrowserAsync(url);
}

// A link that sits inside a sentence. Use it inside a parent <Text>.
function PolicyLinkText({ label, url }: PolicyLinkTextProps) {
  return (
    <Text
      accessibilityRole="link"
      onPress={() => openPolicyPage(url)}
      style={styles.linkText}
    >
      {label}
    </Text>
  );
}

export function ConsentLine() {
  return (
    <Text style={styles.consentText}>
      By creating an account you agree to the{" "}
      <PolicyLinkText label="Terms" url={policyLinks.termsOfUse} /> and{" "}
      <PolicyLinkText label="Privacy Policy" url={policyLinks.privacyPolicy} />.
    </Text>
  );
}

// Two standalone links for the signed-in home screen.
export function PolicyLinksRow() {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="link"
        onPress={() => openPolicyPage(policyLinks.privacyPolicy)}
        style={styles.rowLink}
      >
        <Text style={styles.linkText}>Privacy Policy</Text>
      </Pressable>
      <Pressable
        accessibilityRole="link"
        onPress={() => openPolicyPage(policyLinks.termsOfUse)}
        style={styles.rowLink}
      >
        <Text style={styles.linkText}>Terms of Use</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  consentText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
    textAlign: "center",
  },
  linkText: {
    color: colors.brand.burgundy,
    fontSize: textSize.sm,
    fontWeight: fontWeight.bold,
    textDecorationLine: "underline",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xl,
    justifyContent: "center",
    paddingTop: spacing.lg,
  },
  rowLink: {
    justifyContent: "center",
    minHeight: 40,
  },
});
