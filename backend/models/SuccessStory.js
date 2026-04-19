const mongoose = require("mongoose");

const successStorySchema = new mongoose.Schema({
    submitterName: {
        type: String,
        required: true,
        trim: true
    },
    partnerName: {
        type: String,
        required: true,
        trim: true
    },
    storyType: {
        type: String,
        enum: ["Friend", "Life Partner", "Dating"],
        required: true
    },
    couplePhoto: {
        url: { type: String, required: true },
        imagekitId: { type: String, required: true }
    },
    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending"
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("SuccessStory", successStorySchema);
