import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import {
  compactContentMaxWidth,
  expandedContentMaxWidth,
  useResponsiveLayout,
} from "../../hooks/useResponsiveLayout";

export type ResponsiveContentProps = {
  children: ReactNode;
  expanded?: boolean;
};

export function ResponsiveContent({
  children,
  expanded = false,
}: ResponsiveContentProps) {
  const { isExpanded } = useResponsiveLayout();
  const maxWidth =
    expanded && isExpanded ? expandedContentMaxWidth : compactContentMaxWidth;

  return <View style={[styles.content, { maxWidth }]}>{children}</View>;
}

const styles = StyleSheet.create({
  content: {
    alignSelf: "center",
    width: "100%",
  },
});
