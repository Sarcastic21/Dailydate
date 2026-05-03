const express = require("express");
const auth = require("../middleware/auth");
const adminAuth = require("../middleware/adminAuth");
const SupportRequest = require("../models/SupportRequest");
const User = require("../models/User");
const { createNotification } = require("../services/notificationService");

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

        // Create notification for the user
        await createNotification(
            req.userId,
            "system",
            "Message Sent!",
            "Thankyou for contacting we will contact you with in 48 hours",
            { requestId: newRequest._id, from: "DailyDate" }
        );

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
router.get("/admin/all", adminAuth, async (req, res) => {
    try {
        const { search, dateRange, startDate, endDate } = req.query;
        let query = {};

        // Search filter (User name, email, phone or Subject)
        if (search) {
            const users = await User.find({
                $or: [
                    { name: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } },
                    { phone: { $regex: search, $options: "i" } }
                ]
            }).select("_id");
            
            const userIds = users.map(u => u._id);
            
            query.$or = [
                { userId: { $in: userIds } },
                { subject: { $regex: search, $options: "i" } },
                { message: { $regex: search, $options: "i" } }
            ];
        }

        // Date filter
        if (dateRange || (startDate && endDate)) {
            let start = new Date();
            let end = new Date();
            
            if (dateRange === 'today') {
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
            } else if (dateRange === '7days') {
                start.setDate(start.getDate() - 7);
            } else if (dateRange === '30days') {
                start.setDate(start.getDate() - 30);
            } else if (startDate && endDate) {
                start = new Date(startDate);
                end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
            }
            
            query.createdAt = { $gte: start, $lte: end };
        }

        const requests = await SupportRequest.find(query)
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
router.patch("/admin/status/:id", adminAuth, async (req, res) => {
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

/**
 * @route POST /api/support/admin/reply/:id
 * @desc  Reply to a support request
 * @access Private (Admin)
 */
router.post("/admin/reply/:id", adminAuth, async (req, res) => {
    try {
        const { reply } = req.body;
        if (!reply) {
            return res.status(400).json({ success: false, message: "Reply is required" });
        }

        const request = await SupportRequest.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ success: false, message: "Request not found" });
        }

        request.reply = reply;
        request.repliedAt = Date.now();
        request.status = "resolved"; // Automatically resolve on reply
        await request.save();

        // Send notification to user
        await createNotification(
            request.userId,
            "message",
            "DailyDate Support",
            reply,
            { 
                requestId: request._id,
                type: "support_reply",
                from: "DailyDate"
            }
        );

        res.json({ success: true, message: "Reply sent successfully", request });
    } catch (err) {
        console.error("Support reply error:", err);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

module.exports = router;
