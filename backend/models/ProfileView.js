const mongoose = require("mongoose");

const profileViewSchema = new mongoose.Schema({
    viewerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    targetUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    viewedAt: {
        type: Date,
        default: Date.now
    }
});

// Unique view per day? Or just track all?
// Let's track unique viewer/target pairs per 24h to avoid spamming the metrics.
profileViewSchema.index({ viewerId: 1, targetUserId: 1, viewedAt: -1 });
profileViewSchema.index({ targetUserId: 1, viewedAt: -1 });
profileViewSchema.index({ viewerId: 1, targetUserId: 1 }, { unique: true });

module.exports = mongoose.model("ProfileView", profileViewSchema);
