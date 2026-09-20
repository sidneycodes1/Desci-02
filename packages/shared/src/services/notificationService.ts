export type NotificationType =
  | 'project_created'
  | 'project_state_changed'
  | 'research_log_submitted'
  | 'milestone_submitted'
  | 'milestone_approved'
  | 'milestone_rejected'
  | 'expense_approved'
  | 'agent_alert_triggered';

export interface NotificationRecord {
  id: string;
  userId: string;
  projectId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  userId: string;
  inAppAlerts: boolean;
  emailAlerts: boolean;
  milestoneAlerts: boolean;
  treasuryAlerts: boolean;
  researchLogAlerts: boolean;
}

const notificationsStore: NotificationRecord[] = [];
const userPreferencesStore: Map<string, NotificationPreferences> = new Map();

/**
 * Gets user notification preferences or returns default settings.
 */
export function getUserNotificationPreferences(userId: string): NotificationPreferences {
  const existing = userPreferencesStore.get(userId);
  if (existing) return existing;

  const defaults: NotificationPreferences = {
    userId,
    inAppAlerts: true,
    emailAlerts: false,
    milestoneAlerts: true,
    treasuryAlerts: true,
    researchLogAlerts: true,
  };
  userPreferencesStore.set(userId, defaults);
  return defaults;
}

/**
 * Updates user notification preferences.
 */
export function updateUserNotificationPreferences(
  userId: string,
  prefs: Partial<Omit<NotificationPreferences, 'userId'>>
): NotificationPreferences {
  const current = getUserNotificationPreferences(userId);
  const updated: NotificationPreferences = {
    ...current,
    ...prefs,
  };
  userPreferencesStore.set(userId, updated);
  return updated;
}

/**
 * Creates and dispatches a system notification respecting user preferences.
 */
export function createNotification(
  userId: string,
  projectId: string,
  type: NotificationType,
  title: string,
  message: string
): NotificationRecord | null {
  const prefs = getUserNotificationPreferences(userId);

  if (!prefs.inAppAlerts) {
    return null; // Opted out of in-app alerts
  }

  // Preference category filtering
  if ((type === 'milestone_submitted' || type === 'milestone_approved' || type === 'milestone_rejected') && !prefs.milestoneAlerts) {
    return null;
  }
  if ((type === 'expense_approved' || type === 'agent_alert_triggered') && !prefs.treasuryAlerts) {
    return null;
  }
  if (type === 'research_log_submitted' && !prefs.researchLogAlerts) {
    return null;
  }

  const notification: NotificationRecord = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId,
    projectId,
    type,
    title,
    message,
    read: false,
    createdAt: new Date().toISOString(),
  };

  notificationsStore.unshift(notification);
  return notification;
}

/**
 * Lists notifications for a given user.
 */
export function listUserNotifications(userId: string): NotificationRecord[] {
  return notificationsStore.filter((n) => n.userId === userId);
}

/**
 * Marks a notification as read.
 */
export function markNotificationAsRead(id: string, userId: string): boolean {
  const notif = notificationsStore.find((n) => n.id === id && n.userId === userId);
  if (!notif) return false;
  notif.read = true;
  return true;
}

// Trigger Hooks for System Events

export function notifyResearchLogCreated(params: { authorUserId: string; projectOwnerUserId: string; projectId: string; logTitle: string }) {
  if (params.authorUserId !== params.projectOwnerUserId) {
    createNotification(
      params.projectOwnerUserId,
      params.projectId,
      'research_log_submitted',
      'New Research Log Posted',
      `A new research log "${params.logTitle}" was posted to your project.`
    );
  }
}

export function notifyMilestoneSubmitted(params: { creatorUserId: string; projectOwnerUserId: string; projectId: string; milestoneTitle: string }) {
  createNotification(
    params.projectOwnerUserId,
    params.projectId,
    'milestone_submitted',
    'Milestone Proof Submitted',
    `Proof deliverable for "${params.milestoneTitle}" has been submitted for review.`
  );
}

export function notifyMilestoneApproved(params: { creatorUserId: string; projectId: string; milestoneTitle: string; releaseAmountWei?: string }) {
  const payoutText = params.releaseAmountWei ? ` Payout of ${params.releaseAmountWei} wei authorized.` : '';
  createNotification(
    params.creatorUserId,
    params.projectId,
    'milestone_approved',
    'Milestone Approved!',
    `Your milestone "${params.milestoneTitle}" has been approved.${payoutText}`
  );
}

export function notifyMilestoneRejected(params: { creatorUserId: string; projectId: string; milestoneTitle: string; reason: string }) {
  createNotification(
    params.creatorUserId,
    params.projectId,
    'milestone_rejected',
    'Milestone Revision Required',
    `Milestone "${params.milestoneTitle}" was rejected: ${params.reason}`
  );
}

export function notifyExpenseApproved(params: { proposerUserId: string; projectId: string; memo: string; amountWei: string }) {
  createNotification(
    params.proposerUserId,
    params.projectId,
    'expense_approved',
    'Treasury Expense Approved',
    `Expense "${params.memo}" for ${params.amountWei} wei has been approved.`
  );
}
