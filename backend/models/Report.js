const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
    reporterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    reportedId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    matchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Match"
    },
    reason: {
        type: String,
        default: ""
    },
    status: {
        type: String,
        enum: ["pending", "reviewed", "resolved"],
        default: "pending"
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("Report", reportSchema);
