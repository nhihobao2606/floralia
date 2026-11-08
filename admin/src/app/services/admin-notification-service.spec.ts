import { describe, expect, it } from 'vitest';
import { AdminNotificationService } from './admin-notification-service';

describe('AdminNotificationService', () => {
  it('shares the unread order notification count and updates it when read', () => {
    const service = new AdminNotificationService();
    expect(service.unreadCount).toBe(3);
    service.markAllRead();
    expect(service.unreadCount).toBe(0);
    expect(service.notifications.every(notification => notification.read)).toBe(true);
  });
});
