import { useWindowDimensions } from "react-native";

import { getResponsiveLayoutMode } from "../utils/responsiveLayout";

export {
  compactContentMaxWidth,
  expandedContentMaxWidth,
  expandedLayoutBreakpoint,
} from "../utils/responsiveLayout";

export function useResponsiveLayout() {
  const { width } = useWindowDimensions();
  const layoutMode = getResponsiveLayoutMode(width);

  return {
    isExpanded: layoutMode === "expanded",
    layoutMode,
    width,
  };
}
