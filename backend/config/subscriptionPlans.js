const Pricing = require("../models/Pricing");

/**
 * Get plan by ID from database
 */
async function getPlan(planId) {
    if (!planId) return null;
    const plan = await Pricing.findById(planId);
    if (!plan || !plan.isActive) return null;
    return plan;
}

/**
 * Get plan by tier and duration from database
 */
async function getPlanByTierAndDuration(tier, durationMonths) {
    const plan = await Pricing.findOne({ tier, durationMonths, isActive: true });
    return plan;
}

/**
 * List all active plans for client
 */
async function listPlansForClient() {
    const plans = await Pricing.find({ isActive: true }).sort({ durationMonths: 1 });
    return plans.map(plan => ({
        id: plan._id,
        tier: plan.tier,
        durationMonths: plan.durationMonths,
        originalPrice: plan.originalPrice,
        discountedPrice: plan.discountedPrice,
        discountPercentage: plan.discountPercentage,
        monthlyPrice: plan.monthlyPrice,
        amountPaise: plan.amountPaise,
        label: plan.label,
        badge: plan.badge,
        badgeEmoji: plan.badgeEmoji,
        banner: plan.banner.isActive ? plan.banner : null
    }));
}

/**
 * Legacy function for backward compatibility - returns static plans
 * This is kept for fallback but should not be used in new code
 */
const LEGACY_PLANS = {
    gold_1m: { tier: "gold", durationMonths: 1, amountPaise: 19900, label: "Gold · 1 month" },
    gold_3m: { tier: "gold", durationMonths: 3, amountPaise: 49900, label: "Gold · 3 months" },
    gold_6m: { tier: "gold", durationMonths: 6, amountPaise: 89900, label: "Gold · 6 months" },
    gold_12m: { tier: "gold", durationMonths: 12, amountPaise: 149900, label: "Gold · 1 year" },
};

module.exports = {
    getPlan,
    getPlanByTierAndDuration,
    listPlansForClient,
    LEGACY_PLANS
};
