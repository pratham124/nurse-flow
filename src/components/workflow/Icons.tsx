import { StyleSheet, View } from "react-native";

import { colors } from "../../theme/tokens";

type IconProps = {
  color?: string;
  size?: number;
};

export function PlusIcon({ color = colors.neutral.textPrimary, size = 14 }: IconProps) {
  return (
    <View style={[styles.icon, { height: size, width: size }]}>
      <View style={[styles.horizontalStroke, { backgroundColor: color, width: size }]} />
      <View style={[styles.verticalStroke, { backgroundColor: color, height: size }]} />
    </View>
  );
}

export function MinusIcon({ color = colors.neutral.textPrimary, size = 14 }: IconProps) {
  return (
    <View style={[styles.icon, { height: size, width: size }]}>
      <View style={[styles.horizontalStroke, { backgroundColor: color, width: size }]} />
    </View>
  );
}

export function HomeIcon({ color = colors.neutral.textPrimary, size = 18 }: IconProps) {
  const roofSize = size * 0.62;

  return (
    <View style={[styles.homeIcon, { height: size, width: size }]}>
      <View
        style={[
          styles.homeRoof,
          {
            borderLeftColor: color,
            borderTopColor: color,
            height: roofSize,
            width: roofSize,
          },
        ]}
      />
      <View style={[styles.homeBody, { borderColor: color }]} />
    </View>
  );
}

export function CheckCircleIcon({
  color = colors.status.greenIcon,
  size = 18,
}: IconProps) {
  return (
    <View style={[styles.checkCircle, { borderColor: color, height: size, width: size }]}>
      <View style={[styles.checkMark, { borderBottomColor: color, borderLeftColor: color }]} />
    </View>
  );
}

export function HospitalIcon({
  color = colors.neutral.textSecondary,
  size = 24,
}: IconProps) {
  return (
    <View style={[styles.hospitalIcon, { borderColor: color, height: size, width: size }]}>
      <View style={[styles.crossVertical, { backgroundColor: color }]} />
      <View style={[styles.crossHorizontal, { backgroundColor: color }]} />
      <View style={[styles.hospitalDoor, { borderColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  icon: {
    alignItems: "center",
    justifyContent: "center",
  },
  horizontalStroke: {
    borderRadius: 1,
    height: 1.5,
    position: "absolute",
  },
  verticalStroke: {
    borderRadius: 1,
    position: "absolute",
    width: 1.5,
  },
  homeIcon: {
    alignItems: "center",
    justifyContent: "flex-end",
  },
  homeRoof: {
    borderLeftWidth: 2,
    borderTopWidth: 2,
    position: "absolute",
    top: 1,
    transform: [{ rotate: "45deg" }],
  },
  homeBody: {
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    borderTopWidth: 0,
    borderWidth: 2,
    height: 9,
    width: 12,
  },
  checkCircle: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1.5,
    justifyContent: "center",
  },
  checkMark: {
    borderBottomWidth: 1.5,
    borderLeftWidth: 1.5,
    height: 5,
    marginTop: -1,
    transform: [{ rotate: "-45deg" }],
    width: 8,
  },
  hospitalIcon: {
    alignItems: "center",
    borderRadius: 4,
    borderWidth: 1.5,
    justifyContent: "center",
  },
  crossVertical: {
    borderRadius: 1,
    height: 9,
    position: "absolute",
    top: 5,
    width: 2,
  },
  crossHorizontal: {
    borderRadius: 1,
    height: 2,
    position: "absolute",
    top: 8.5,
    width: 9,
  },
  hospitalDoor: {
    borderBottomWidth: 0,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    borderWidth: 1.5,
    bottom: 0,
    height: 6,
    position: "absolute",
    width: 6,
  },
});
