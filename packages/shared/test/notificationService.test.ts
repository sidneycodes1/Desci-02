import { describe, expect, it } from 'vitest';
import {
  createNotification,
  listUserNotifications,
  markNotificationAsRead,
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  notifyResearchLogCreated,
  notifyMilestoneSubmitted,
  notifyMilestoneApproved,
} from '../services/notificationService';

describe('Notification Service & Triggers', () => {
  it('manages user notification preferences', () => {
    const defaultPrefs = getUserNotificationPreferences('pref-user-1');
    expect(defaultPrefs.inAppAlerts).toBe(true);
    expect(defaultPrefs.emailAlerts).toBe(false);

    const updated = updateUserNotificationPreferences('pref-user-1', {
      emailAlerts: true,
      milestoneAlerts: false,
    });

    expect(updated.emailAlerts).toBe(true);
    expect(updated.milestoneAlerts).toBe(false);
  });

  it('respects user preferences when creating notifications', () => {
    updateUserNotificationPreferences('pref-user-2', { inAppAlerts: false });
    const notif = createNotification(
      'pref-user-2',
      'p-1',
      'project_created',
      'Project Created',
      'New project launched'
    );
    expect(notif).toBeNull();
  });

  it('dispatches research log trigger notification', () => {
    notifyResearchLogCreated({
      authorUserId: 'collab-1',
      projectOwnerUserId: 'owner-1',
      projectId: 'proj-101',
      logTitle: 'New Dataset Published',
    });

    const notifs = listUserNotifications('owner-1');
    expect(notifs.length).toBeGreaterThan(0);
    expect(notifs[0].title).toBe('New Research Log Posted');
  });

  it('dispatches milestone approval trigger notification', () => {
    notifyMilestoneApproved({
      creatorUserId: 'creator-1',
      projectId: 'proj-102',
      milestoneTitle: 'Phase 1 Complete',
      releaseAmountWei: '1000000000000000000',
    });

    const notifs = listUserNotifications('creator-1');
    expect(notifs.length).toBeGreaterThan(0);
    expect(notifs[0].message).toContain('Payout of 1000000000000000000 wei authorized');
  });
});
