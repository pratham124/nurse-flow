import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  BedChip,
  NumberStepperPlaceholder,
  PlaceholderButton,
  PlaceholderInput,
  SwipeRevealAction,
  WorkflowListScreen,
  WorkflowSection,
} from "../components/workflow";
import { createLocalId } from "../helpers/localId";
import { useLocalState } from "../store/LocalStateContext";
import { colors, radius, spacing, textSize } from "../theme/tokens";
import type { Room } from "../types/models";

const requiredRoomNameMessage = "Room name is required.";
const requiredRoomMessage = "Add at least one room to continue.";

function RoomsListHeader({
  roomName,
  roomNameError,
  onRoomNameChange,
  onAddRoom,
}: {
  roomName: string;
  roomNameError: string;
  onRoomNameChange: (text: string) => void;
  onAddRoom: () => void;
}) {
  return (
    <View style={styles.headerContent}>
      <WorkflowSection
        note="Rooms will become the structure used by the local assignment board."
        title="Add room"
      >
        <PlaceholderInput
          errorText={roomNameError}
          helperText="Room names can be numbers or short names."
          label="Room name"
          onChangeText={onRoomNameChange}
          placeholder="101"
          value={roomName}
        />
        <PlaceholderButton label="Add room" onPress={onAddRoom} />
      </WorkflowSection>

      <View style={styles.roomsHeader}>
        <Text style={styles.roomsTitle}>Rooms</Text>
        <Text style={styles.roomsNote}>
          Added rooms are saved to this draft floor template.
        </Text>
      </View>
    </View>
  );
}

function RoomRow({
  room,
  onRemoveRoom,
}: {
  room: Room;
  onRemoveRoom: (roomId: string) => void;
}) {
  const roomBedCount = room.bedCount.toString();
  const bedCountText = room.bedCount === 1 ? "1 bed" : `${room.bedCount} beds`;

  return (
    <SwipeRevealAction
      accessibilityLabel={`Remove room ${room.label}`}
      actionLabel="Remove"
      onActionPress={() => onRemoveRoom(room.id)}
    >
      <View style={styles.roomRow}>
        <View style={styles.roomTopRow}>
          <View>
            <Text style={styles.roomLabel}>Room {room.label}</Text>
            <Text style={styles.roomMeta}>{bedCountText}</Text>
          </View>
          <View style={styles.roomActions}>
            <NumberStepperPlaceholder value={roomBedCount} />
          </View>
        </View>

        <View style={styles.roomFooterRow}>
          <View style={styles.bedPreview}>
            {room.bedCount > 0
              ? Array.from({ length: room.bedCount }).map((_, index) => (
                  <BedChip
                    key={`${room.id}-bed-preview-${index + 1}`}
                    label={`${room.label}-${index + 1}`}
                  />
                ))
            : null}
          </View>
        </View>
      </View>
    </SwipeRevealAction>
  );
}

function getRoomKey(room: Room) {
  return room.id;
}

export default function RoomsAndBedsScreen() {
  const { localState, setLocalState } = useLocalState();
  const [roomName, setRoomName] = useState("");
  const [roomNameError, setRoomNameError] = useState("");
  const [roomListError, setRoomListError] = useState("");
  const screenTitle = localState.draftFloorTemplate?.name ?? "Rooms and beds";
  const rooms = localState.draftFloorTemplate?.rooms ?? [];

  function handleRoomNameChange(text: string) {
    setRoomName(text);

    if (roomNameError) {
      setRoomNameError("");
    }
  }

  function handleAddRoom() {
    const trimmedRoomName = roomName.trim();

    if (!trimmedRoomName) {
      setRoomNameError(requiredRoomNameMessage);
      return;
    }

    setLocalState((currentState) => {
      const currentDraft = currentState.draftFloorTemplate;

      if (!currentDraft) {
        return currentState;
      }

      return {
        ...currentState,
        draftFloorTemplate: {
          ...currentDraft,
          rooms: [
            ...currentDraft.rooms,
            {
              id: createLocalId("room"),
              doctorSideId: "",
              label: trimmedRoomName,
              bedCount: 1,
            },
          ],
        },
      };
    });

    setRoomName("");
    setRoomListError("");
  }

  function handleRemoveRoom(roomId: string) {
    setLocalState((currentState) => {
      const currentDraft = currentState.draftFloorTemplate;

      if (!currentDraft) {
        return currentState;
      }

      return {
        ...currentState,
        draftFloorTemplate: {
          ...currentDraft,
          rooms: currentDraft.rooms.filter((room) => room.id !== roomId),
          beds: currentDraft.beds.filter((bed) => bed.roomId !== roomId),
        },
      };
    });
  }

  function handleContinue() {
    if (rooms.length === 0) {
      setRoomListError(requiredRoomMessage);
      return;
    }

    router.push("/doctor-sides");
  }

  function renderRoomItem({ item }: { item: Room }) {
    return <RoomRow onRemoveRoom={handleRemoveRoom} room={item} />;
  }

  return (
    <WorkflowListScreen
      activeStep="Rooms"
      data={rooms}
      headerActionLabel="Floors"
      helperText="Room changes are saved locally in the draft floor template."
      keyExtractor={getRoomKey}
      listHeader={
        <RoomsListHeader
          onAddRoom={handleAddRoom}
          onRoomNameChange={handleRoomNameChange}
          roomName={roomName}
          roomNameError={roomNameError}
        />
      }
      listFooter={
        rooms.length === 0 ? (
          <RoomListFooter errorText={roomListError} />
        ) : undefined
      }
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={handleContinue}
      primaryLabel="Continue"
      renderItem={renderRoomItem}
      subtitle="Step 2 of 4"
      title={screenTitle}
    />
  );
}

function RoomListFooter({ errorText }: { errorText: string }) {
  return (
    <View style={styles.roomListFooter}>
      {errorText ? <RoomListError message={errorText} /> : null}
      <EmptyRoomsMessage />
    </View>
  );
}

function RoomListError({ message }: { message: string }) {
  return (
    <View accessibilityRole="alert" style={styles.roomListError}>
      <Text style={styles.roomListErrorTitle}>Room required</Text>
      <Text style={styles.roomListErrorText}>{message}</Text>
    </View>
  );
}

function EmptyRoomsMessage() {
  return (
    <View style={styles.emptyRooms}>
      <Text style={styles.emptyRoomsTitle}>No rooms added yet.</Text>
      <Text style={styles.emptyRoomsText}>
        Add the first room name to start building this floor template.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContent: {
    gap: spacing.cardGap,
  },
  roomsHeader: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  roomsTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: "500",
  },
  roomsNote: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  roomRow: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  roomTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  roomActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  roomFooterRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  bedPreview: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  roomLabel: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: "500",
  },
  roomMeta: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
  },
  roomListFooter: {
    gap: spacing.sm,
  },
  roomListError: {
    backgroundColor: colors.status.red50,
    borderColor: colors.status.red700,
    borderLeftWidth: 3,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: 2,
    padding: spacing.md,
  },
  roomListErrorTitle: {
    color: colors.status.red700,
    fontSize: textSize.sm,
    fontWeight: "600",
  },
  roomListErrorText: {
    color: colors.status.red700,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  emptyRooms: {
    alignItems: "center",
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  emptyRoomsTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: "500",
    textAlign: "center",
  },
  emptyRoomsText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
    textAlign: "center",
  },
});
