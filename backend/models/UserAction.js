const mongoose = require("mongoose");

const userActionSchema = new mongoose.Schema({
    userId: {
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
    actionType: {
        type: String,
        enum: ["like", "skip", "block"],
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        default: null, // Used for 'skip' so profiles reset after X hours
    }
});

userActionSchema.index({ userId: 1, targetUserId: 1 }, { unique: true });
userActionSchema.index({ userId: 1, actionType: 1, timestamp: -1 });
userActionSchema.index({ targetUserId: 1, actionType: 1, timestamp: -1 });
userActionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("UserAction", userActionSchema);