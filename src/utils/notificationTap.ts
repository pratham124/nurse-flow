import type { NotificationEventTargetRoute } from "../types/models";

export type NotificationTapPayload = {
  recipientAccessId?: string;
  relatedRequestId?: string;
  shiftId: string;
  targetRoute: NotificationEventTargetRoute;
};

const notificationTargetRoutes: NotificationEventTargetRoute[] = [
  "requestDetail",
  "requestsList",
  "joinedNurseAssignment",
  "floorBoard",
  "flags",
];

function getStringValue(
  data: Record<string, unknown>,
  camelCaseKey: string,
  snakeCaseKey: string,
) {
  const value = data[camelCaseKey] ?? data[snakeCaseKey];

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function parseNotificationTapPayload(
  value: unknown,
): NotificationTapPayload | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const data = value as Record<string, unknown>;
  const shiftId = getStringValue(data, "shiftId", "shift_id");
  const targetRoute = getStringValue(data, "targetRoute", "target_route");
  const relatedRequestId = getStringValue(
    data,
    "relatedRequestId",
    "related_request_id",
  );
  const recipientAccessId = getStringValue(
    data,
    "recipientAccessId",
    "recipient_access_id",
  );

  if (
    !shiftId ||
    !targetRoute ||
    !notificationTargetRoutes.includes(
      targetRoute as NotificationEventTargetRoute,
    )
  ) {
    return undefined;
  }

  if (targetRoute === "requestDetail" && !relatedRequestId) {
    return undefined;
  }

  if (targetRoute === "joinedNurseAssignment" && !recipientAccessId) {
    return undefined;
  }

  return {
    recipientAccessId,
    relatedRequestId,
    shiftId,
    targetRoute: targetRoute as NotificationEventTargetRoute,
  };
}
