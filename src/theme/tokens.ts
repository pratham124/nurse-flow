export const colors = {
  brand: {
    burgundy: "#6b1e3a",
    burgundy10: "rgba(107, 30, 58, 0.1)",
    burgundy12: "rgba(107, 30, 58, 0.12)",
    burgundy15: "rgba(107, 30, 58, 0.15)",
    burgundyLight: "#c0476a",
  },
  status: {
    amber50: "#faeeda",
    amber800: "#633806",
    blue50: "#e6f1fb",
    blue800: "#0c447c",
    green50: "#eaf3de",
    green700: "#4f7f2a",
    green800: "#27500a",
    greenIcon: "#3b6d11",
    greenBorder: "#c0dd97",
    gray100: "#d3d1c7",
    gray800: "#444441",
    red50: "#fcebeb",
    red700: "#a23a3a",
    red800: "#501313",
    yellow700: "#b77712",
  },
  neutral: {
    backgroundPrimary: "#f7f7f8",
    backgroundSecondary: "#f1eff1",
    backgroundTertiary: "#fbfafb",
    borderSecondary: "#ded7da",
    borderTertiary: "#ebe6e8",
    textPrimary: "#211a1d",
    textSecondary: "#746b70",
    textTertiary: "#948b90",
    background: "#f7f7f8",
    surface: "#ffffff",
    secondarySurface: "#f1eff1",
    elevatedSurface: "#fbfafb",
    text: "#211a1d",
    mutedText: "#746b70",
    subtleText: "#948b90",
    border: "#ded7da",
    softBorder: "#ebe6e8",
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  cardGap: 14,
  lg: 16,
  xl: 20,
} as const;

export const radius = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 16,
  pill: 999,
} as const;

export const textSize = {
  xs: 11,
  sm: 12,
  md: 14,
  action: 15,
  lg: 16,
  xl: 24,
} as const;
