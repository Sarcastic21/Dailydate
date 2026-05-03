const mongoose = require("mongoose");

const globalNotificationSchema = new mongoose.Schema(
    {
        title: { type: String, required: true },
        body: { type: String, required: true },
        target: { 
            type: String, 
            enum: ["all", "male", "female"], 
            default: "all" 
        },
        sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
        userCount: { type: Number, default: 0 },
        isPushSent: { type: Boolean, default: false },
    },
    { timestamps: true }
);

module.exports = mongoose.model("GlobalNotification", globalNotificationSchema);
