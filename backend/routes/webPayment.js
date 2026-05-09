const express = require("express");
const crypto = require("crypto");
const auth = require("../middleware/auth");
const User = require("../models/User");
const Pricing = require("../models/Pricing");
const { buildSubscriptionPayload, hasPremiumAccess } = require("../services/subscription");
const { cancelAllPending } = require("../services/botInteractionService");

const router = express.Router();

/**
 * PayU Hash Calculation
 * Sequence: key|txid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt
 */
function generateHash(params) {
    const { key, txnid, amount, productinfo, firstname, email, salt } = params;
    const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
    return crypto.createHash("sha512").update(hashString).digest("hex");
}

/**
 * PayU Generic Hash calculation for Checkout Pro / Dynamic hashing
 */
router.post("/hash-dynamic", auth, (req, res) => {
    const { hashString } = req.body;
    const salt = process.env.PAYU_SALT;
    
    if (!hashString) {
        return res.status(400).json({ error: "hashString is required" });
    }

    const calculatedHash = crypto.createHash("sha512").update(hashString + salt).digest("hex");
    res.json({ hash: calculatedHash });
});

router.post("/create-payu-hash", auth, async (req, res) => {
    try {
        const { planId, platform } = req.body;
        const plan = await Pricing.findById(planId);
        if (!plan) {
            return res.status(400).json({ success: false, message: "Invalid plan" });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(400).json({ success: false, message: "User not found" });
        }

        const key = process.env.PAYU_MERCHANT_KEY;
        const salt = process.env.PAYU_SALT;

        if (!key || !salt) {
            return res.status(503).json({ success: false, message: "Payment setup incomplete" });
        }

        const txnid = `T${Date.now()}${req.userId.toString().slice(-4)}`;
        const amount = String((plan.discountedPrice).toFixed(2));
        const productinfo = plan.label;
        const firstname = user.name || "User";
        const email = user.email || "";

        const hash = generateHash({ key, txnid, amount, productinfo, firstname, email, salt });

        const isTest = process.env.PAYU_ENV === 'test';
        const payuUrl = isTest ? 'https://test.payu.in/_payment' : 'https://secure.payu.in/_payment';

        const baseUrl = process.env.BACKEND_URL;
        const queryParam = platform === 'web' ? '?source=web' : '';

        res.json({
            success: true,
            payuParams: {
                key,
                txnid,
                amount,
                productinfo,
                firstname,
                email,
                hash,
                env: isTest ? 1 : 0,
                payuUrl,
                surl: `${baseUrl}/api/webPayment/payu-success${queryParam}`,
                furl: `${baseUrl}/api/webPayment/payu-failure${queryParam}`,
            }
        });
    } catch (err) {
        console.error("create-payu-hash:", err);
        res.status(500).json({ success: false, message: "Could not generate hash" });
    }
});

router.all("/payu-success", async (req, res) => {
    const frontEndUrl = process.env.FRONTEND_URL;
    try {
        const payuData = req.method === 'POST' ? req.body : req.query;
        const txnid = payuData.txnid || req.query.txnid;
        
        if (req.query.source === 'web' || payuData.service_provider === 'payu_paisa') {
            return res.redirect(`${frontEndUrl}/settings?payment=success&txnid=${txnid || ''}`);
        }
        
        res.send(`<html><body><p>Payment Successful</p></body></html>`);
    } catch (err) {
        res.redirect(`${frontEndUrl}/settings?payment=error`);
    }
});

router.all("/payu-failure", async (req, res) => {
    const frontEndUrl = process.env.FRONTEND_URL;
    res.redirect(`${frontEndUrl}/settings?payment=failed`);
});

router.post("/verify-payu-payment", auth, async (req, res) => {
    try {
        const { status, txnid, planId } = req.body;

        if (status !== "success") {
            return res.status(400).json({ success: false, message: "Payment was not successful" });
        }

        const plan = await Pricing.findById(planId);
        if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const now = new Date();
        const isNewSubscription = !user.subscriptionExpiresAt || new Date(user.subscriptionExpiresAt) <= now;
        
        const base = (!isNewSubscription)
            ? new Date(user.subscriptionExpiresAt)
            : now;

        const next = new Date(base);
        next.setMonth(next.getMonth() + plan.durationMonths);

        // Update unified fields
        if (!user.subscriptionStart || isNewSubscription) {
            user.subscriptionStart = now;
        }
        user.subscriptionExpiresAt = next;
        user.subscriptionRenewal = now;
        user.subscriptionStatus = 'active';
        user.accountType = plan.tier;
        await user.save();

        if (hasPremiumAccess(user)) {
            await cancelAllPending(user._id);
        }

        res.json({
            success: true,
            user: user,
            subscription: buildSubscriptionPayload(user),
        });
    } catch (err) {
        console.error("verify payu:", err);
        res.status(500).json({ success: false, message: "Verification failed" });
    }
});

module.exports = router;
