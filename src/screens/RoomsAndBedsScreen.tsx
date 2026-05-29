import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  BedChip,
  BedChipRow,
  NumberStepperPlaceholder,
  PlaceholderButton,
  PlaceholderInput,
  WorkflowListScreen,
  WorkflowSection,
} from "../components/workflow";
import { createLocalId } from "../helpers/localId";
import { useLocalState } from "../store/LocalStateContext";
import { colors, radius, spacing, textSize } from "../theme/tokens";
import type { Room } from "../types/models";

const requiredRoomNameMessage = "Room name is required.";

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

function RoomRow({ room }: { room: Room }) {
  const roomBedCount = room.bedCount.toString();
  const bedCountText = room.bedCount === 1 ? "1 bed" : `${room.bedCount} beds`;

  return (
    <View style={styles.roomRow}>
      <View style={styles.roomTopRow}>
        <View>
          <Text style={styles.roomLabel}>Room {room.label}</Text>
          <Text style={styles.roomMeta}>{bedCountText}</Text>
        </View>
        <NumberStepperPlaceholder value={roomBedCount} />
      </View>

      {room.bedCount > 0 ? (
        <BedChipRow>
          {Array.from({ length: room.bedCount }).map((_, index) => (
            <BedChip
              key={`${room.id}-bed-preview-${index + 1}`}
              label={`${room.label}-${index + 1}`}
            />
          ))}
        </BedChipRow>
      ) : null}
    </View>
  );
}

function renderRoomItem({ item }: { item: Room }) {
  return <RoomRow room={item} />;
}

function getRoomKey(room: Room) {
  return room.id;
}

export default function RoomsAndBedsScreen() {
  const { localState, setLocalState } = useLocalState();
  const [roomName, setRoomName] = useState("");
  const [roomNameError, setRoomNameError] = useState("");
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
      listFooter={rooms.length === 0 ? <EmptyRoomsMessage /> : undefined}
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => router.push("/doctor-sides")}
      primaryLabel="Continue"
      renderItem={renderRoomItem}
      subtitle="Step 2 of 4"
      title={screenTitle}
    />
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
  roomLabel: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: "500",
  },
  roomMeta: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
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
