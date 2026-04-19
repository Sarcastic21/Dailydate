const express = require("express");
const SuccessStory = require("../models/SuccessStory");
const router = express.Router();

// ─── PUBLIC ENDPOINTS ───────────────────────────────────────

/** Submit a success story */
router.post("/submit", async (req, res) => {
    try {
        const { submitterName, partnerName, storyType, couplePhoto } = req.body;

        if (!submitterName || !partnerName || !storyType || !couplePhoto?.url) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const newStory = await SuccessStory.create({
            submitterName,
            partnerName,
            storyType,
            couplePhoto,
            status: "pending"
        });

        res.json({ 
            success: true, 
            message: "Success story submitted! It will appear on the landing page after admin approval.",
            storyId: newStory._id 
        });
    } catch (err) {
        console.error("Story submission error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/** Fetch approved stories for Landing Page */
router.get("/approved", async (req, res) => {
    try {
        const stories = await SuccessStory.find({ status: "approved" }).sort({ createdAt: -1 });
        res.json({ success: true, stories });
    } catch (err) {
        console.error("Fetch stories error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// ─── ADMIN ENDPOINTS ────────────────────────────────────────

/** Fetch all stories (Admin Only) */
router.get("/admin/all", async (req, res) => {
    try {
        // In a real app, add admin auth middleware here. 
        // For now, assuming admin dashboard handles auth.
        const stories = await SuccessStory.find().sort({ createdAt: -1 });
        res.json({ success: true, stories });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/** Moderate a story (Approve/Reject) */
router.patch("/admin/moderate/:id", async (req, res) => {
    try {
        const { status } = req.body;
        if (!["approved", "rejected", "pending"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status" });
        }

        const story = await SuccessStory.findByIdAndUpdate(
            req.params.id, 
            { status }, 
            { new: true }
        );

        if (!story) return res.status(404).json({ success: false, message: "Story not found" });

        res.json({ success: true, message: `Story ${status} successfully`, story });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/** Delete a story */
router.delete("/admin/delete/:id", async (req, res) => {
    try {
        await SuccessStory.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Story deleted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

module.exports = router;
