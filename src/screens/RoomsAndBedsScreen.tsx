import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  BedChip,
  BedChipRow,
  NumberStepperPlaceholder,
  PlaceholderButton,
  PlaceholderInput,
  PlusIcon,
  SwipeRevealAction,
  TrashIcon,
  WorkflowListScreen,
  WorkflowSection,
} from "../components/workflow";
import { createLocalId } from "../helpers/localId";
import { useWorkflowDraft } from "../store/WorkflowDraftContext";
import { colors, radius, spacing, textSize, fontWeight, shadows } from "../theme/tokens";
import type { Bed, Room } from "../types/models";

const requiredRoomNameMessage = "Room name is required.";
const duplicateRoomNameMessage = "Room already exists.";
const requiredRoomMessage = "Add at least one room to continue.";

type RoomsListHeaderProps = {
  roomName: string;
  roomNameError: string;
  onRoomNameChange: (text: string) => void;
  onAddRoom: () => void;
};

type RoomRowProps = {
  room: Room;
  onRemoveRoom: (roomId: string) => void;
  onUpdateBedCount: (roomId: string, bedCount: number) => void;
};

type RoomListFooterProps = {
  errorText: string;
};

type RoomListErrorProps = {
  message: string;
};

function RoomsListHeader({
  roomName,
  roomNameError,
  onRoomNameChange,
  onAddRoom,
}: RoomsListHeaderProps) {
  return (
    <View style={styles.headerContent}>
      <WorkflowSection title="Add room">
        <PlaceholderInput
          errorText={roomNameError}
          label="Room name"
          onChangeText={onRoomNameChange}
          placeholder="101"
          value={roomName}
        />
        <PlaceholderButton
          icon={<PlusIcon color={colors.neutral.surface} size={12} />}
          label="Add room"
          onPress={onAddRoom}
          variant="primary"
        />
      </WorkflowSection>

      <View style={styles.divider} />

      <View style={styles.roomsHeader}>
        <Text style={styles.roomsTitle}>Rooms</Text>
      </View>
    </View>
  );
}

function RoomRow({
  room,
  onRemoveRoom,
  onUpdateBedCount,
}: RoomRowProps) {
  const roomBedCount = room.bedCount.toString();
  const bedCountText = room.bedCount === 1 ? "1 bed" : `${room.bedCount} beds`;
  const canDecreaseBedCount = room.bedCount > 1;

  return (
    <SwipeRevealAction
      accessibilityLabel={`Remove room ${room.label}`}
      actionLabel="Remove"
      actionIcon={<TrashIcon color={colors.neutral.surface} size={18} />}
      actionSide="left"
      actionWidth={72}
      onActionPress={() => onRemoveRoom(room.id)}
    >
      <View style={styles.roomRow}>
        <View style={styles.roomTopRow}>
          <View>
            <Text style={styles.roomLabel}>Room {room.label}</Text>
            <Text style={styles.roomMeta}>{bedCountText}</Text>
          </View>
          <View style={styles.roomActions}>
            <NumberStepperPlaceholder
              decrementLabel={`Decrease bed count for room ${room.label}`}
              incrementLabel={`Increase bed count for room ${room.label}`}
              onDecrement={
                canDecreaseBedCount
                  ? () => onUpdateBedCount(room.id, room.bedCount - 1)
                  : undefined
              }
              onIncrement={() => onUpdateBedCount(room.id, room.bedCount + 1)}
              value={roomBedCount}
            />
          </View>
        </View>

        <View style={styles.roomFooterRow}>
          <BedChipRow>
            {Array.from({ length: room.bedCount }).map((_, index) => (
              <BedChip
                key={`${room.id}-bed-preview-${index + 1}`}
                label={`${room.label}-${index + 1}`}
              />
            ))}
          </BedChipRow>
        </View>
      </View>
    </SwipeRevealAction>
  );
}

function getRoomKey(room: Room) {
  return room.id;
}

function createRoomBed(room: Room, bedNumber: number): Bed {
  return {
    id: createLocalId("bed"),
    roomId: room.id,
    label: `${room.label}-${bedNumber}`,
    bedNumber,
  };
}

export default function RoomsAndBedsScreen() {
  const { draftFloorTemplate, setDraftFloorTemplate } = useWorkflowDraft();
  const [roomName, setRoomName] = useState("");
  const [roomNameError, setRoomNameError] = useState("");
  const [roomListError, setRoomListError] = useState("");
  const screenTitle = draftFloorTemplate?.name ?? "Rooms and beds";
  const rooms = draftFloorTemplate?.rooms ?? [];

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

    const hasDuplicateRoomName = rooms.some(
      (room) => room.label.trim() === trimmedRoomName,
    );

    if (hasDuplicateRoomName) {
      setRoomNameError(duplicateRoomNameMessage);
      return;
    }

    setDraftFloorTemplate((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      const newRoom: Room = {
        id: createLocalId("room"),
        doctorSideId: "",
        label: trimmedRoomName,
        bedCount: 1,
      };

      return {
        ...currentDraft,
        rooms: [...currentDraft.rooms, newRoom],
        beds: [...currentDraft.beds, createRoomBed(newRoom, 1)],
      };
    });

    setRoomName("");
    setRoomListError("");
  }

  function handleRemoveRoom(roomId: string) {
    setDraftFloorTemplate((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      return {
        ...currentDraft,
        rooms: currentDraft.rooms.filter((room) => room.id !== roomId),
        beds: currentDraft.beds.filter((bed) => bed.roomId !== roomId),
      };
    });
  }

  function handleUpdateBedCount(roomId: string, bedCount: number) {
    setDraftFloorTemplate((currentDraft) => {
      const roomToUpdate = currentDraft?.rooms.find((room) => room.id === roomId);

      if (!currentDraft || !roomToUpdate) {
        return currentDraft;
      }

      const updatedRoom = {
        ...roomToUpdate,
        bedCount,
      };
      const isAddingBed = bedCount > roomToUpdate.bedCount;
      const updatedBeds = isAddingBed
        ? [...currentDraft.beds, createRoomBed(updatedRoom, bedCount)]
        : currentDraft.beds.filter(
            (bed) =>
              !(bed.roomId === roomId && bed.bedNumber === roomToUpdate.bedCount),
          );

      return {
        ...currentDraft,
        rooms: currentDraft.rooms.map((room) =>
          room.id === roomId ? updatedRoom : room,
        ),
        beds: updatedBeds,
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
    return (
      <RoomRow
        onRemoveRoom={handleRemoveRoom}
        onUpdateBedCount={handleUpdateBedCount}
        room={item}
      />
    );
  }

  return (
    <WorkflowListScreen
      activeStep="Rooms"
      data={rooms}
      headerActionLabel="Floors"
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

function RoomListFooter({ errorText }: RoomListFooterProps) {
  return (
    <View style={styles.roomListFooter}>
      {errorText ? <RoomListError message={errorText} /> : null}
      <EmptyRoomsMessage />
    </View>
  );
}

function RoomListError({ message }: RoomListErrorProps) {
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
    fontWeight: fontWeight.bold,
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral.borderTertiary,
    marginVertical: spacing.xs,
  },
  roomRow: {
    backgroundColor: colors.neutral.surface,
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
    alignItems: "stretch",
  },
  roomLabel: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
  },
  roomMeta: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
  },
  roomListFooter: {
    gap: spacing.sm,
  },
  roomListError: {
    backgroundColor: colors.status.red50,
    borderColor: colors.status.red700,
    borderLeftWidth: 4,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: 2,
    padding: spacing.md,
  },
  roomListErrorTitle: {
    color: colors.status.red700,
    fontSize: textSize.sm,
    fontWeight: fontWeight.bold,
  },
  roomListErrorText: {
    color: colors.status.red700,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  emptyRooms: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.xs,
    padding: spacing.lg,
    ...shadows.sm,
  },
  emptyRoomsTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
    textAlign: "center",
  },
  emptyRoomsText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
    textAlign: "center",
  },
});
