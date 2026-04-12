const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema({
    user1Id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    user2Id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['matched', 'unmatched', 'blocked'],
        default: 'matched'
    },
    matchedAt: {
        type: Date,
        default: Date.now
    },
    mutualMatch: {
        type: Boolean,
        default: false
    },
    action: {
        user1Action: {
            type: String,
            enum: ['like', 'none'],
            default: 'none'
        },
        user2Action: {
            type: String,
            enum: ['like', 'none'],
            default: 'none'
        }
    },
    isApproved: {
        type: Boolean,
        default: false
    },
    hasBotRevisited: {
        type: Boolean,
        default: false
    },
    lastMessageAt: {
        type: Date
    }
}, {
    timestamps: true
});

matchSchema.index({ user1Id: 1, user2Id: 1 }, { unique: true });
matchSchema.index({ user1Id: 1, status: 1, matchedAt: -1 });
matchSchema.index({ user2Id: 1, status: 1, matchedAt: -1 });
matchSchema.index({ status: 1, mutualMatch: 1, matchedAt: -1 });

module.exports = mongoose.model("Match", matchSchema);