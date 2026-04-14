const express = require("express");
const crypto = require("crypto");
const auth = require("../middleware/auth");
const User = require("../models/User");
const { getPlan, listPlansForClient } = require("../config/subscriptionPlans");
const { buildSubscriptionPayload, hasPremiumAccess } = require("../services/subscription");
const { cancelAllPending } = require("../services/botInteractionService");

const router = express.Router();

function getRazorpay() {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) return null;
    const Razorpay = require("razorpay");
    return new Razorpay({ key_id, key_secret });
}

router.get("/plans", auth, async (req, res) => {
    try {
        const plans = await listPlansForClient();
        res.json({
            success: true,
            plans,
            keyId: process.env.RAZORPAY_KEY_ID || "",
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

router.post("/create-order", auth, async (req, res) => {
    try {
        const { planId } = req.body;
        const plan = await getPlan(planId);
        if (!plan) {
            return res.status(400).json({ success: false, message: "Invalid plan" });
        }

        const razorpay = getRazorpay();
        if (!razorpay) {
            return res.status(503).json({
                success: false,
                message: "Payments are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
            });
        }

        const receipt = `r_${String(req.userId).slice(-8)}_${Date.now()}`.slice(0, 40);
        const order = await razorpay.orders.create({
            amount: plan.amountPaise,
            currency: "INR",
            receipt,
            notes: {
                userId: String(req.userId),
                planId,
                tier: plan.tier,
            },
        });

        res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
            planId,
            planLabel: plan.label,
        });
    } catch (err) {
        console.error("create-order:", err);
        res.status(500).json({ success: false, message: err.message || "Could not create order" });
    }
});

router.post("/verify", auth, async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            planId,
        } = req.body;

        if (
            !razorpay_order_id ||
            !razorpay_payment_id ||
            !razorpay_signature ||
            !planId
        ) {
            return res.status(400).json({ success: false, message: "Missing payment fields" });
        }

        const plan = await getPlan(planId);
        if (!plan) {
            return res.status(400).json({ success: false, message: "Invalid plan" });
        }

        const secret = process.env.RAZORPAY_KEY_SECRET;
        if (!secret) {
            return res.status(503).json({ success: false, message: "Payment verification unavailable" });
        }

        const body = `${razorpay_order_id}|${razorpay_payment_id}`;
        const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
        if (expected !== razorpay_signature) {
            return res.status(400).json({ success: false, message: "Invalid payment signature" });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const now = new Date();
        const base =
            user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > now
                ? new Date(user.subscriptionExpiresAt)
                : now;

        const next = new Date(base);
        next.setMonth(next.getMonth() + plan.durationMonths);

        user.subscriptionExpiresAt = next;
        user.accountType = plan.tier;
        await user.save();

        if (hasPremiumAccess(user)) {
            await cancelAllPending(user._id);
        }

        res.json({
            success: true,
            subscription: buildSubscriptionPayload(user),
        });
    } catch (err) {
        console.error("verify payment:", err);
        res.status(500).json({ success: false, message: "Verification failed" });
    }
});

module.exports = router;
