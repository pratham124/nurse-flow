export const colors = {
  brand: {
    softGreen: "#b9d2b5",
    warmGold: "#f4cb8d",
    lavender: "#d1b2d2",
    burgundy: "#823549",
    lightBlue: "#b5e9f6",
  },
  acuity: {
    green: "#2f8f4e",
    yellow: "#c78a00",
    red: "#c62828",
  },
  neutral: {
    background: "#f8f7f8",
    surface: "#ffffff",
    text: "#211a1d",
    mutedText: "#6b5f64",
    border: "#ded7da",
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radius = {
  sm: 4,
  md: 8,
} as const;

export const textSize = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
} as const;
