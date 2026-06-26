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

export function TrashIcon({ color = colors.neutral.textPrimary, size = 18 }: IconProps) {
  const bodyHeight = size * 0.62;
  const bodyWidth = size * 0.68;

  return (
    <View style={[styles.trashIcon, { height: size, width: size }]}>
      <View style={[styles.trashLid, { backgroundColor: color, width: bodyWidth }]} />
      <View style={[styles.trashHandle, { borderColor: color }]} />
      <View
        style={[
          styles.trashBody,
          {
            borderColor: color,
            height: bodyHeight,
            width: bodyWidth,
          },
        ]}
      >
        <View style={[styles.trashLine, { backgroundColor: color }]} />
        <View style={[styles.trashLine, { backgroundColor: color }]} />
      </View>
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

export function ChevronRightIcon({
  color = colors.neutral.textSecondary,
  size = 14,
}: IconProps) {
  const arrowSize = size * 0.45;
  return (
    <View style={[styles.icon, { height: size, width: size }]}>
      <View
        style={{
          borderColor: color,
          borderRightWidth: 2,
          borderTopWidth: 2,
          height: arrowSize,
          width: arrowSize,
          transform: [{ rotate: "45deg" }],
          marginLeft: -size * 0.15,
        }}
      />
    </View>
  );
}

export function BedIcon({
  color = colors.neutral.textSecondary,
  size = 14,
}: IconProps) {
  return (
    <View style={[styles.bedIcon, { height: size, width: size }]}>
      <View style={[styles.bedHeadboard, { backgroundColor: color }]} />
      <View style={[styles.bedBody, { backgroundColor: color }]} />
      <View style={[styles.bedPillow, { backgroundColor: color }]} />
    </View>
  );
}

export function RoomIcon({
  color = colors.neutral.textSecondary,
  size = 14,
}: IconProps) {
  return (
    <View style={[styles.roomIcon, { borderColor: color, height: size, width: size }]}>
      <View style={[styles.roomDoor, { borderColor: color }]} />
    </View>
  );
}

export function CopyIcon({
  color = colors.neutral.textSecondary,
  size = 18,
}: IconProps) {
  return (
    <View style={[styles.copyIcon, { height: size, width: size }]}>
      <View
        style={[
          styles.copyBackPage,
          {
            borderColor: color,
            height: size * 0.66,
            width: size * 0.58,
          },
        ]}
      />
      <View
        style={[
          styles.copyFrontPage,
          {
            borderColor: color,
            height: size * 0.66,
            width: size * 0.58,
          },
        ]}
      />
    </View>
  );
}

export function ShareIcon({
  color = colors.neutral.textSecondary,
  size = 18,
}: IconProps) {
  return (
    <View style={[styles.shareIcon, { height: size, width: size }]}>
      <View style={[styles.shareStem, { backgroundColor: color }]} />
      <View
        style={[
          styles.shareArrowLeft,
          {
            borderColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.shareArrowRight,
          {
            borderColor: color,
          },
        ]}
      />
      <View style={[styles.shareTray, { borderColor: color }]} />
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
  trashIcon: {
    alignItems: "center",
    justifyContent: "flex-end",
  },
  trashLid: {
    borderRadius: 1,
    height: 1.6,
    position: "absolute",
    top: 3,
  },
  trashHandle: {
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    borderTopWidth: 1.5,
    height: 4,
    position: "absolute",
    top: 0,
    width: 7,
  },
  trashBody: {
    alignItems: "center",
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    borderTopWidth: 0,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 3,
    justifyContent: "center",
  },
  trashLine: {
    borderRadius: 1,
    height: 7,
    width: 1.4,
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
  bedIcon: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "flex-start",
    position: "relative",
  },
  bedHeadboard: {
    width: 2,
    height: "85%",
    borderRadius: 0.5,
    position: "absolute",
    left: 0,
    bottom: 0,
  },
  bedBody: {
    width: "75%",
    height: "45%",
    borderRadius: 0.5,
    position: "absolute",
    right: 0,
    bottom: 0,
  },
  bedPillow: {
    width: "25%",
    height: "20%",
    borderRadius: 0.5,
    position: "absolute",
    left: 3,
    top: "35%",
  },
  roomIcon: {
    borderRadius: 3,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  roomDoor: {
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
    width: "45%",
    height: "55%",
  },
  copyIcon: {
    position: "relative",
  },
  copyBackPage: {
    borderRadius: 3,
    borderWidth: 1.5,
    left: 2,
    position: "absolute",
    top: 1,
  },
  copyFrontPage: {
    backgroundColor: colors.neutral.surface,
    borderRadius: 3,
    borderWidth: 1.5,
    bottom: 1,
    position: "absolute",
    right: 2,
  },
  shareIcon: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  shareStem: {
    borderRadius: 1,
    height: 11,
    position: "absolute",
    top: 2,
    width: 1.8,
  },
  shareArrowLeft: {
    borderLeftWidth: 1.8,
    borderTopWidth: 1.8,
    height: 6,
    position: "absolute",
    top: 2,
    transform: [{ rotate: "45deg" }],
    width: 6,
  },
  shareArrowRight: {
    borderRightWidth: 1.8,
    borderTopWidth: 1.8,
    height: 6,
    position: "absolute",
    top: 2,
    transform: [{ rotate: "-45deg" }],
    width: 6,
  },
  shareTray: {
    borderRadius: 3,
    borderTopWidth: 0,
    borderWidth: 1.8,
    bottom: 1,
    height: 7,
    position: "absolute",
    width: 14,
  },
});
