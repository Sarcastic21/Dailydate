const mongoose = require("mongoose");

/**
 * Persisted only when the user had no active Socket.IO session (app background/killed),
 * so they can see activity after opening the app. Not used for foreground/in-app toasts.
 */
const notificationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: ["message", "like", "match", "view", "revisit"],
            required: true,
        },
        title: { type: String, default: "" },
        body: { type: String, default: "" },
        data: { type: mongoose.Schema.Types.Mixed, default: {} },
        read: { type: Boolean, default: false },
        // Track if this was delivered via push notification
        pushDelivered: { type: Boolean, default: false },
        // Priority level for notification filtering
        priority: {
            type: String,
            enum: ["high", "medium", "low"],
            default: "medium"
        },
        // Whether user had this notification type enabled when it was created
        userPreferenceEnabled: { type: Boolean, default: true },
    },
    { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
