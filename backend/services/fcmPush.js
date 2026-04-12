const User = require("../models/User");
const { getAdmin } = require("../config/firebaseAdmin");

function toDataStrings(obj) {
    const out = {};
    if (!obj) return out;
    for (const [k, v] of Object.entries(obj)) {
        if (v == null) continue;
        out[k] = String(v);
    }
    return out;
}

/**
 * System-tray push. Call only when the recipient has no active Socket.IO session
 * (callers persist a Notification row in that case for the in-app list).
 */
async function sendChatMessagePush(receiverId, { title, body, data }) {
    const admin = getAdmin();
    if (!admin) return;

    const user = await User.findById(receiverId).select("fcmToken").lean();
    const token = user?.fcmToken;
    if (!token || typeof token !== "string") return;

    try {
        await admin.messaging().send({
            token,
            // Data-only: prevents Android from auto-showing a system notification.
            // The app's background handler (Notifee) shows it instead — no duplicates.
            data: toDataStrings({ title: title || "New message", body: body || "", ...data }),
            android: { priority: "high" },
            apns: {
                payload: {
                    aps: { contentAvailable: true, sound: "default" },
                },
            },
        });
    } catch (err) {
        const code = err?.errorInfo?.code || err?.code;
        if (
            code === "messaging/invalid-registration-token" ||
            code === "messaging/registration-token-not-registered"
        ) {
            await User.findByIdAndUpdate(receiverId, { fcmToken: null });
        }
        console.error("[FCM] send failed:", code || err.message);
    }
}

module.exports = { sendChatMessagePush };
