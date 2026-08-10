export const expandedLayoutBreakpoint = 768;
export const compactContentMaxWidth = 720;
export const expandedContentMaxWidth = 1200;

export type ResponsiveLayoutMode = "compact" | "expanded";

export function getResponsiveLayoutMode(
  contentWidth: number,
): ResponsiveLayoutMode {
  return contentWidth >= expandedLayoutBreakpoint ? "expanded" : "compact";
}
