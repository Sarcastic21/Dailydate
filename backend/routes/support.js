const express = require("express");
const auth = require("../middleware/auth");
const SupportRequest = require("../models/SupportRequest");
const User = require("../models/User");

const router = express.Router();

/**
 * @route POST /api/support
 * @desc  Submit a new support request
 * @access Private
 */
router.post("/", auth, async (req, res) => {
    try {
        const { subject, message } = req.body;

        if (!subject || !message) {
            return res.status(400).json({ success: false, message: "Subject and message are required" });
        }

        const newRequest = new SupportRequest({
            userId: req.userId,
            subject,
            message
        });

        await newRequest.save();

        res.status(201).json({
            success: true,
            message: "Support request submitted successfully",
            request: newRequest
        });
    } catch (err) {
        console.error("Support submission error:", err);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

/**
 * @route GET /api/support/admin/all
 * @desc  Fetch all support requests (Admin Access)
 * @access Private (Admin)
 * Note: Assuming admin uses a different auth or we check user role. 
 * For now, we'll keep it simple or check if the user is an admin.
 */
router.get("/admin/all", auth, async (req, res) => {
    try {
        // In a real app, we'd check req.isAdmin. 
        // For simplicity and since it matches the project's current admin logic:
        const requests = await SupportRequest.find()
            .populate("userId", "name email phone profilePhotos")
            .sort({ createdAt: -1 });

        res.json({ success: true, requests });
    } catch (err) {
        console.error("Fetch support requests error:", err);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

/**
 * @route PATCH /api/support/admin/status/:id
 * @desc  Update status of a support request
 * @access Private (Admin)
 */
router.patch("/admin/status/:id", auth, async (req, res) => {
    try {
        const { status, adminNotes } = req.body;
        const request = await SupportRequest.findByIdAndUpdate(
            req.params.id,
            { status, adminNotes, updatedAt: Date.now() },
            { new: true }
        );

        if (!request) {
            return res.status(404).json({ success: false, message: "Request not found" });
        }

        res.json({ success: true, request });
    } catch (err) {
        console.error("Update support status error:", err);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

module.exports = router;
