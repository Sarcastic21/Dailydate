const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
    {
        matchId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Match",
            required: true,
            index: true,
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        receiverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        content: {
            type: String,
            trim: true,
            maxlength: 5000,
            default: "",
        },
        media: {
            kind: {
                type: String,
                enum: ["image", "video", "gif"],
                default: undefined,
            },
            url: { type: String, default: "" },
            imagekitId: { type: String, default: "" },
        },
        readStatus: {
            read: { type: Boolean, default: false },
            readAt: { type: Date, default: null },
        },
        deliveredAt: { type: Date, default: null },
        deleted: { type: Boolean, default: false },
    },
    {    
        timestamps: true,
    }
);

messageSchema.index({ matchId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, receiverId: 1 });

module.exports = mongoose.model("Message", messageSchema);
