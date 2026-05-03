const mongoose = require("mongoose");

const sessionHistorySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true, index: true }, // Format: YYYY-MM-DD
    loginCount: { type: Number, default: 0 },
}, {
    timestamps: true
});

// Compound index for fast querying per user per day
sessionHistorySchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("SessionHistory", sessionHistorySchema);
