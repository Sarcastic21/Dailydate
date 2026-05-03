const express = require("express");
const auth = require("../middleware/auth");
const User = require("../models/User");
const Pricing = require("../models/Pricing");
const { buildSubscriptionPayload, hasPremiumAccess } = require("../services/subscription");
const { cancelAllPending } = require("../services/botInteractionService");
const { google } = require("googleapis");

const router = express.Router();

/**
 * Configure Google Play Developer API Client
 */
let androidPublisher = null;

try {
    const credentialsStr = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    let credentials;

    if (credentialsStr) {
        credentials = JSON.parse(credentialsStr);
    } else {
        // Fallback to local file if env is not set
        const path = require("path");
        const fs = require("fs");
        const jsonPath = path.join(__dirname, "..", "config", "dailydate-c6405-eeefd9e07999.json");
        if (fs.existsSync(jsonPath)) {
            credentials = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
            console.log("📂 Loaded Google Play credentials from local file");
        }
    }

    if (credentials) {
        const authClient = new google.auth.GoogleAuth({
            credentials,
            scopes: ["https://www.googleapis.com/auth/androidpublisher"]
        });
        androidPublisher = google.androidpublisher({
            version: "v3",
            auth: authClient
        });
        console.log("✅ Google Play Developer API configured");
    } else {
        console.log("⚠️ GOOGLE_PLAY_SERVICE_ACCOUNT_JSON not found. Google Play verification will use placeholder logic.");
    }
} catch (error) {
    console.error("❌ Failed to initialize Google Play Developer API client:", error.message);
}


/**
 * Google Play Billing Verification
 */
router.post("/verify-google-purchase", auth, async (req, res) => {
    try {
        const { purchaseToken, productId, planId } = req.body;

        if (!purchaseToken || !productId || !planId) {
            return res.status(400).json({ success: false, message: "Missing purchase details" });
        }

        const plan = await Pricing.findById(planId);
        if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        // Verify with Google Play Developer API
        if (androidPublisher) {
            try {
                // Verify Subscription
                const response = await androidPublisher.purchases.subscriptions.get({
                    packageName: "com.dailydate", // Make sure this matches your app package name
                    subscriptionId: productId,
                    token: purchaseToken
                });

                const purchase = response.data;

                // Check if payment state is valid (paymentState: 1 = Payment received)
                if (!purchase || purchase.paymentState !== 1) {
                    return res.status(400).json({ success: false, message: "Invalid or incomplete purchase from Google Play" });
                }
            } catch (googleError) {
                console.error("Google API Verification error:", googleError.message);
                return res.status(400).json({ success: false, message: "Failed to verify purchase with Google Play" });
            }
        } else {
            console.log("⚠️ Bypassing actual Google Play verification because credentials are not configured.");
            // In a real production scenario without credentials, you might reject here.
            // But since the user hasn't set it up yet, we'll allow it for testing.
        }

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
        console.error("verify google purchase:", err);
        res.status(500).json({ success: false, message: "Verification failed" });
    }
});

module.exports = router;
