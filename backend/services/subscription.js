const User = require("../models/User");

function todayYMD() {
    return new Date().toISOString().slice(0, 10);
}

function getEffectiveTier(user) {
    if (!user) return "normal";
    const exp = user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : null;
    if (!exp || exp.getTime() <= Date.now()) return "normal";
    const t = user.accountType;
    if (t === "gold") return t;
    return "normal";
}

function hasPremiumAccess(user) {
    const tier = getEffectiveTier(user);
    return tier === "gold";
}

async function ensureUsageDay(user) {
    if (!user.usageDaily) {
        user.usageDaily = { date: "", likesUsed: 0, messageRecipientIds: [] };
    }
    const today = todayYMD();
    if (user.usageDaily.date !== today) {
        user.usageDaily.date = today;
        user.usageDaily.likesUsed = 0;
        user.usageDaily.messageRecipientIds = [];
        await user.save();
    }
}

function canLike(user) {
    const tier = getEffectiveTier(user);
    if (tier !== "normal") return { ok: true };
    const used = user.usageDaily?.likesUsed || 0;
    if (used >= 10) {
        return {
            ok: false,
            code: "DAILY_LIKE_LIMIT",
            message: "You have used all 10 free likes today. Upgrade for unlimited likes.",
        };
    }
    return { ok: true };
}

function canSendMessage(user, receiverId) {
    const tier = getEffectiveTier(user);
    if (tier === "normal") {
        return {
            ok: false,
            code: "SUBSCRIPTION_REQUIRED",
            message: "Messaging requires Gold. Upgrade to chat.",
        };
    }

    const rid = String(receiverId);
    const raw = user.usageDaily?.messageRecipientIds || [];
    const recipients = raw.map((id) => String(id));
    if (recipients.includes(rid)) return { ok: true };
    if (recipients.length >= 50) {
        return {
            ok: false,
            code: "GOLD_MESSAGE_LIMIT",
            message:
                "Gold allows messaging up to 50 different people per day.",
        };
    }
    return { ok: true };
}

async function incrementDailyLike(user) {
    await ensureUsageDay(user);
    user.usageDaily.likesUsed = (user.usageDaily.likesUsed || 0) + 1;
    await user.save();
}

async function recordMessageRecipientIfNeeded(user, receiverId) {
    await ensureUsageDay(user);
    if (getEffectiveTier(user) !== "gold") return;
    const rid = String(receiverId);
    const raw = user.usageDaily.messageRecipientIds || [];
    if (raw.some((id) => String(id) === rid)) return;
    raw.push(receiverId);
    user.usageDaily.messageRecipientIds = raw;
    user.markModified("usageDaily.messageRecipientIds");
    await user.save();
}

function subscriptionDaysRemaining(user) {
    if (!user?.subscriptionExpiresAt) return 0;
    const exp = new Date(user.subscriptionExpiresAt);
    if (exp.getTime() <= Date.now()) return 0;
    return Math.max(0, Math.ceil((exp.getTime() - Date.now()) / 86400000));
}

function buildSubscriptionPayload(user) {
    const tier = getEffectiveTier(user);
    const likesUsed = user.usageDaily?.likesUsed || 0;
    const msgRecipients = (user.usageDaily?.messageRecipientIds || []).length;
    let likesRemainingToday = null;
    let goldNewRecipientsRemaining = null;
    if (tier === "normal") {
        likesRemainingToday = Math.max(0, 10 - likesUsed);
    }
    if (tier === "gold") {
        goldNewRecipientsRemaining = Math.max(0, 50 - msgRecipients);
    }
    return {
        accountType: user.accountType,
        effectiveTier: tier,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        subscriptionDaysRemaining: subscriptionDaysRemaining(user),
        likesRemainingToday,
        goldNewRecipientsRemaining,
        hasPremiumAccess: hasPremiumAccess(user),
    };
}

module.exports = {
    todayYMD,
    getEffectiveTier,
    hasPremiumAccess,
    ensureUsageDay,
    canLike,
    canSendMessage,
    incrementDailyLike,
    recordMessageRecipientIfNeeded,
    subscriptionDaysRemaining,
    buildSubscriptionPayload,
};
