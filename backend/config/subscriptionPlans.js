/**
 * Razorpay amounts in paise (INR × 100). planId is sent from the app when creating an order.
 */
const PLANS = {
    gold_1m: { tier: "gold", durationMonths: 1, amountPaise: 19900, label: "Gold · 1 month" },
    gold_3m: { tier: "gold", durationMonths: 3, amountPaise: 49900, label: "Gold · 3 months" },
    gold_6m: { tier: "gold", durationMonths: 6, amountPaise: 89900, label: "Gold · 6 months" },
    gold_12m: { tier: "gold", durationMonths: 12, amountPaise: 149900, label: "Gold · 1 year" },
    platinum_1m: { tier: "platinum", durationMonths: 1, amountPaise: 29900, label: "Platinum · 1 month" },
    platinum_3m: { tier: "platinum", durationMonths: 3, amountPaise: 59900, label: "Platinum · 3 months" },
    platinum_6m: { tier: "platinum", durationMonths: 6, amountPaise: 99900, label: "Platinum · 6 months" },
    platinum_12m: { tier: "platinum", durationMonths: 12, amountPaise: 159900, label: "Platinum · 1 year" },
};

function getPlan(planId) {
    if (!planId || typeof planId !== "string") return null;
    return PLANS[planId] || null;
}

function listPlansForClient() {
    return Object.entries(PLANS).map(([id, p]) => ({
        id,
        tier: p.tier,
        durationMonths: p.durationMonths,
        amountRupees: p.amountPaise / 100,
        amountPaise: p.amountPaise,
        label: p.label,
    }));
}

module.exports = { PLANS, getPlan, listPlansForClient };
