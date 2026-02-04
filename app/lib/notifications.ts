export type NotificationType =
  | 'leave_review'
  | 'review_featured'
  | 'recommendations'
  | 'order_status'
  | 'discount';

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  readAt?: string | null;
  href?: string | null;
  payload?: Record<string, unknown> | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function parseNotifications(value: unknown): Notification[] {
  if (typeof value !== 'string' || !value.length) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(isRecord)
      .filter((item) => typeof item.id === 'string' && item.id.length)
      .filter((item) => typeof item.type === 'string' && item.type.length)
      .filter((item) => typeof item.title === 'string' && item.title.length)
      .filter((item) => typeof item.message === 'string' && item.message.length)
      .filter(
        (item) => typeof item.createdAt === 'string' && item.createdAt.length,
      )
      .map((item) => ({
        id: item.id as string,
        type: item.type as NotificationType,
        title: item.title as string,
        message: item.message as string,
        createdAt: item.createdAt as string,
        readAt:
          typeof item.readAt === 'string' ? (item.readAt as string) : null,
        href: typeof item.href === 'string' ? (item.href as string) : null,
        payload: isRecord(item.payload) ? item.payload : null,
      }));
  } catch {
    return [];
  }
}

export function getUnreadCount(notifications: Notification[]) {
  return notifications.filter((notification) => !notification.readAt).length;
}

export function createNotificationId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

