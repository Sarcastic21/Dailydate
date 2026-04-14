const mongoose = require("mongoose");

const profilePhotoSchema = new mongoose.Schema({
    url: { type: String, required: true },
    imagekitId: { type: String, default: "" },
    isPrimary: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
});

const userSchema = new mongoose.Schema({
    // ── Basic Auth ──────────────────────────────────────
    name: { type: String, default: "" },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, default: "" },
    otp: { type: String, default: "" },
    otpExpiry: { type: Date, default: null },
    isVerified: { type: Boolean, default: false },
    googleUser: { type: Boolean, default: false },

    // ── Profile ─────────────────────────────────────────
    profilePhotos: { type: [profilePhotoSchema], default: [] },
    bio: { type: String, default: "", maxlength: 500 },
    gender: { type: String, enum: ["male", "female", "non-binary", ""], default: "" },
    state: { type: String, default: "" },
    city: { type: String, default: "" },
    dateOfBirth: {
        day: Number,
        month: Number,
        year: Number,
        fullDate: Date,
    },

    // ── Preferences ─────────────────────────────────────
    lookingFor: { type: String, enum: ["male", "female", "everyone", ""], default: "" },
    intention: { type: String, enum: ["Marriage", "Serious Relationship", "Dating", "Casual", "Friendship", "Not Sure Yet", ""], default: "" },
    ageRange: { min: { type: Number, default: 18 }, max: { type: Number, default: 35 } },
    maxDistance: { type: Number, default: 50 },

    // ── Account & subscription ──────────────────────────
    userType: { type: String, enum: ["real", "bot"], default: "real" },
    status: { type: String, enum: ["married", "single", "divorced", ""], default: "" },
    accountType: { type: String, enum: ["normal", "gold"], default: "normal" },
    /** Active until this instant; messaging/likes limits use subscription + usageDaily */
    subscriptionExpiresAt: { type: Date, default: null },
    /** Resets daily (UTC date string YYYY-MM-DD) */
    usageDaily: {
        date: { type: String, default: "" },
        likesUsed: { type: Number, default: 0 },
        /** Gold: distinct match partners messaged today (max 50 new threads/day) */
        messageRecipientIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    },
    isProfileComplete: { type: Boolean, default: false },
    profileCompletionStep: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now },
    isOnline: { type: Boolean, default: false },
    updatedAt: { type: Date, default: Date.now },
    /** Latest FCM device token (single device); updated on login / token refresh */
    fcmToken: { type: String, default: null },

    //  Notification Preferences
    notificationPreferences: {
        messages: { type: Boolean, default: true },
        likes: { type: Boolean, default: true },
        views: { type: Boolean, default: true },
        matches: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
    },

    // ── Detailed Profile ───────────────────────────────
    personality: {
        hobbies: [{ type: String }],
        interests: [{ type: String }],
        personalityType: { type: String, enum: ["Introvert", "Extrovert", "Ambivert", ""] },
        zodiac: { type: String, default: "" },
        education: { type: String, default: "" },
        profession: { type: String, default: "" },
        workIndustry: { type: String, default: "" },
    },
    lifestyle: {
        drinking: { type: String, enum: ["Never", "Occasionally", "Socially", "Frequently", ""] },
        smoking: { type: String, enum: ["No", "Sometimes", "Yes", ""] },
        partying: { type: String, enum: ["Never", "Sometimes", "Often", ""] },
        workout: { type: String, enum: ["Regular", "Sometimes", "Never", ""] },
        diet: { type: String, enum: ["Veg", "Non-veg", "Vegan", ""] },
    },
    physical: {
        height: { type: String, default: "" }, // Store as string for flexibility (e.g., "5'10\"")
        weight: { type: String, default: "" },
        bodyType: { type: String, enum: ["Slim", "Athletic", "Average", "Heavy", ""] },
        skinTone: { type: String, default: "" },
        hairType: { type: String, default: "" },
    },
    beliefs: {
        religion: { type: String, default: "" },
        caste: { type: String, default: "" },
        languages: [{ type: String }],
        nationality: { type: String, default: "" },
        wantKids: { type: String, enum: ["Yes", "No", "Maybe", ""] },
        openToLongDistance: { type: String, enum: ["Yes", "No", "Maybe", ""] },
    },

    // ── Stats ────────────────────────────────────────────
    stats: {
        totalLikes: { type: Number, default: 0 },
        totalMatches: { type: Number, default: 0 },
        profileViews: { type: Number, default: 0 },
    },

    // ── Subscription ──────────────────────────────────────
    subscriptionStart: { type: Date, default: null },
    subscriptionExpiry: { type: Date, default: null },
    subscriptionRenewal: { type: Date, default: null },
    subscriptionStatus: { 
        type: String, 
        enum: ['none', 'active', 'expired', 'cancelled'],
        default: 'none'
    },

    // ── Deactivation & Deletion ──────────────────────────
    deletionRequestedAt: { type: Date, default: null },
    isDeactivated: { type: Boolean, default: false },
    deactivatedAt: { type: Date, default: null },

    // ── Blocked Users ─────────────────────────────────────
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }],

    createdAt: { type: Date, default: Date.now },
});

// Indexes for performance optimization
userSchema.index({ gender: 1, state: 1, lastActive: -1 });
userSchema.index({ state: 1, lastActive: -1 });
userSchema.index({ gender: 1, lastActive: -1 });
userSchema.index({ "dateOfBirth.fullDate": 1 });
userSchema.index({ isOnline: 1, lastActive: -1 });
userSchema.index({ fcmToken: 1 });

module.exports = mongoose.model("User", userSchema);