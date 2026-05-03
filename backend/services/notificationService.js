const Notification = require('../models/Notification');
const User = require('../models/User');
const GlobalNotification = require('../models/GlobalNotification');
const { getAdmin } = require('../config/firebaseAdmin');

/**
 * Create and store notification, send FCM if user is offline
 * Only stores in DB if user is offline/app is closed, otherwise just sends in-app notification
 */
async function createNotification(userId, type, title, body, data = {}) {
    try {
        // Prevent self-notifications (e.g., user viewing their own profile)
        const viewerId = data?.viewerId || data?.senderId;
        if (viewerId && String(viewerId) === String(userId)) {
            console.log(`[Notification] Skipping self-notification for user ${userId}, type: ${type}`);
            return false;
        }

        // Get user's notification preferences
        const user = await User.findById(userId);
        if (!user) return false;

        // Check if user has this notification type enabled
        const preferenceKey = type === 'message' ? 'messages' :
            type === 'like' ? 'likes' :
                type === 'view' || type === 'revisit' ? 'views' :
                    type === 'match' ? 'matches' : null;

        if (preferenceKey && !user.notificationPreferences?.[preferenceKey]) {
            console.log(`[Notification] User ${userId} has disabled ${preferenceKey} notifications`);
            return false;
        }

        // Determine priority based on type
        const priority = type === 'message' ? 'high' :
            type === 'match' ? 'high' :
                type === 'like' ? 'medium' : 'low';

        // Always store in database to track unread counts across all screens
        let notification = new Notification({
            userId,
            type,
            title,
            body,
            data,
            priority,
            userPreferenceEnabled: true,
        });
        await notification.save();

        // Always send FCM push if user has a token.
        // We do NOT rely on isOnline here because that flag has a race condition —
        // it stays true for a few seconds after the app is backgrounded/killed.
        // FCM handles delivery correctly: foreground handler shows in-app banner,
        // background/killed handler shows system tray notification.
        if (user.fcmToken) {
            await sendFCMNotification(user.fcmToken, title, body, {
                type,
                priority,
                ...data,
                notificationId: notification?._id?.toString() || ''
            });

            notification.pushDelivered = true;
            await notification.save();
        }

        return notification;
    } catch (error) {
        console.error('[Notification] Error creating notification:', error);
        return false;
    }
}

/**
 * Send FCM notification
 */
async function sendFCMNotification(fcmToken, title, body, data = {}) {
    const admin = getAdmin();
    if (!admin) {
        console.warn('[FCM] Firebase Admin not initialized — skipping push');
        return false;
    }
    try {
        const message = {
            token: fcmToken,
            // Data-only message: no notification block so Android does NOT auto-show a system tray
            // notification. The app's background handler (index.js) displays via Notifee instead.
            // This prevents duplicate notifications.
            data: {
                title,
                body,
                ...Object.keys(data).reduce((acc, key) => {
                    acc[key] = String(data[key]);
                    return acc;
                }, {}),
            },
            android: {
                priority: 'high',
            },
            apns: {
                payload: {
                    aps: {
                        contentAvailable: true,
                        sound: 'default',
                        badge: 1,
                    },
                },
            },
        };

        const response = await admin.messaging().send(message);
        console.log('[FCM] Notification sent successfully:', response);
        return true;
    } catch (error) {
        console.error('[FCM] Error sending notification:', error);
        return false;
    }
}

/**
 * Send FCM notifications to multiple users in batches
 */
async function sendBulkFCMNotifications(tokens, title, body, data = {}) {
    const admin = getAdmin();
    if (!admin || !tokens.length) return false;

    try {
        const messages = tokens.map(token => ({
            token,
            data: {
                title,
                body,
                ...Object.keys(data).reduce((acc, key) => {
                    acc[key] = String(data[key]);
                    return acc;
                }, {}),
            },
            android: { priority: 'high' },
        }));

        // Batch send in chunks of 500 (Firebase limit)
        for (let i = 0; i < messages.length; i += 500) {
            const batch = messages.slice(i, i + 500);
            await admin.messaging().sendEach(batch);
            console.log(`[FCM] Sent batch ${i / 500 + 1} (${batch.length} messages)`);
        }
        return true;
    } catch (error) {
        console.error('[FCM] Error in bulk send:', error);
        return false;
    }
}

/**
 * Get user's notifications with pagination (Merging personal and dynamic global)
 */
async function getUserNotifications(userId, page = 1, limit = 20) {
    try {
        const user = await User.findById(userId).select('createdAt gender');
        if (!user) return { notifications: [], pagination: { page, limit, total: 0, pages: 0 }, unread: 0 };

        // 1. Fetch personal notifications
        // We fetch a reasonable amount to merge, or use a more complex aggregate if needed.
        // For simplicity and since most users don't have thousands, we fetch them.
        const personalNotifications = await Notification.find({ userId })
            .sort({ createdAt: -1 })
            .lean();

        // 2. Fetch relevant global notifications
        // Showing notifications created AFTER (or at the same time as) the user joined.
        // We add a small 5-second buffer to handle sub-second creation differences.
        const startTime = new Date(user.createdAt.getTime() - 5000);
        const globalNotifications = await GlobalNotification.find({
            createdAt: { $gte: startTime },
            $or: [
                { target: 'all' },
                { target: user.gender }
            ]
        }).sort({ createdAt: -1 }).lean();

        // 3. Format global notifications
        const formattedGlobals = globalNotifications.map(gn => ({
            _id: gn._id,
            type: 'global',
            title: gn.title,
            body: gn.body,
            createdAt: gn.createdAt,
            read: false, // App handles read status locally or via different logic
            data: { from: 'DailyDate', isGlobal: true },
            priority: 'medium'
        }));

        // 4. Combine and sort
        const allNotifications = [...personalNotifications, ...formattedGlobals]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // 5. Paginate
        const skip = (page - 1) * limit;
        const paginated = allNotifications.slice(skip, skip + limit);
        const total = allNotifications.length;
        const unreadCount = allNotifications.filter(n => !n.read).length;

        return {
            notifications: paginated,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
            unread: unreadCount,
        };
    } catch (error) {
        console.error('[Notification] Error fetching notifications:', error);
        return { notifications: [], pagination: { page, limit, total: 0, pages: 0 }, unread: 0 };
    }
}

/**
 * Mark notification as read
 */
async function markNotificationAsRead(notificationId, userId) {
    try {
        const result = await Notification.updateOne(
            { _id: notificationId, userId },
            { read: true }
        );
        return result.modifiedCount > 0;
    } catch (error) {
        console.error('[Notification] Error marking as read:', error);
        return false;
    }
}

/**
 * Mark all notifications as read for user
 */
async function markAllNotificationsAsRead(userId) {
    try {
        const result = await Notification.updateMany(
            { userId, read: false },
            { read: true }
        );
        return result.modifiedCount;
    } catch (error) {
        console.error('[Notification] Error marking all as read:', error);
        return 0;
    }
}

/**
 * Update user notification preferences
 */
async function updateNotificationPreferences(userId, preferences) {
    try {
        const result = await User.updateOne(
            { _id: userId },
            {
                $set: {
                    'notificationPreferences.messages': preferences.messages,
                    'notificationPreferences.likes': preferences.likes,
                    'notificationPreferences.views': preferences.views,
                    'notificationPreferences.matches': preferences.matches,
                    'notificationPreferences.email': preferences.email,
                }
            }
        );
        return result.modifiedCount > 0;
    } catch (error) {
        console.error('[Notification] Error updating preferences:', error);
        return false;
    }
}

module.exports = {
    createNotification,
    sendFCMNotification,
    getUserNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    updateNotificationPreferences,
    sendBulkFCMNotifications,
};
