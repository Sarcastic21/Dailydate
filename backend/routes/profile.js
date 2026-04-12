const express = require("express");
const ImageKit = require("imagekit");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { buildSubscriptionPayload } = require("../services/subscription");
const { scheduleInitialActivity } = require("../services/botInteractionService");

const router = express.Router();

const imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// Get own profile
router.get("/me", auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId)
            .select("-password -otp -otpExpiry")
            .lean();
        if (!user) return res.status(404).json({ message: "Not found", success: false });
        const full = await User.findById(req.userId);
        const subscription = buildSubscriptionPayload(full);

        // Calculate age if not already stored
        const age = user.age || (user.dateOfBirth?.fullDate ? Math.floor((Date.now() - new Date(user.dateOfBirth.fullDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null);

        // Calculate hours remaining if deletion is requested
        let hoursRemaining = null;
        if (user.deletionRequestedAt) {
            const elapsed = Date.now() - new Date(user.deletionRequestedAt).getTime();
            hoursRemaining = Math.max(0, Math.ceil((48 * 60 * 60 * 1000 - elapsed) / (60 * 60 * 1000)));
        }

        res.json({
            success: true,
            user: {
                ...user,
                age,
                subscription,
                isVerified: user.isVerified || false,
                hoursRemaining
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", success: false });
    }
});

// Profile completion status
router.get("/status", auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const steps = {
            dob: !!user.dateOfBirth?.fullDate,
            state: !!user.state,
            city: !!user.city,
            gender: !!user.gender,
            lookingFor: !!user.lookingFor,
            photos: user.profilePhotos?.length > 0,
            bio: !!user.bio,
        };
        res.json({ success: true, steps, isComplete: user.isProfileComplete, currentStep: user.profileCompletionStep });
    } catch (err) {
        res.status(500).json({ message: "Server error", success: false });
    }
});

// Save DOB
router.post("/dob", auth, async (req, res) => {
    try {
        const { day, month, year } = req.body;
        if (!day || !month || !year)
            return res.status(400).json({ message: "All fields required", success: false });

        const fullDate = new Date(year, month - 1, day);
        const age = Math.floor((Date.now() - fullDate) / (365.25 * 24 * 60 * 60 * 1000));
        if (age < 18)
            return res.status(400).json({ message: "Must be 18+", success: false });

        await User.findByIdAndUpdate(req.userId, {
            dateOfBirth: { day, month, year, fullDate },
            profileCompletionStep: Math.max(1, (await User.findById(req.userId)).profileCompletionStep),
        });
        res.json({ success: true, message: "DOB saved", nextStep: 2 });
    } catch (err) {
        res.status(500).json({ message: "Server error", success: false });
    }
});

// Save State
router.post("/state", auth, async (req, res) => {
    try {
        const { state, city } = req.body;
        if (!state || !city) return res.status(400).json({ message: "City and State required", success: false });
        await User.findByIdAndUpdate(req.userId, { state, city });
        res.json({ success: true, message: "Location saved" });
    } catch (err) {
        res.status(500).json({ message: "Server error", success: false });
    }
});

// Save Gender
router.post("/gender", auth, async (req, res) => {
    try {
        const { gender } = req.body;
        if (!gender) return res.status(400).json({ message: "Required", success: false });
        await User.findByIdAndUpdate(req.userId, { gender, profileCompletionStep: 2 });
        res.json({ success: true, message: "Gender saved", nextStep: 3 });
    } catch (err) {
        res.status(500).json({ message: "Server error", success: false });
    }
});

// Save Looking For
router.post("/looking-for", auth, async (req, res) => {
    try {
        const { lookingFor } = req.body;
        if (!lookingFor) return res.status(400).json({ message: "Required", success: false });
        await User.findByIdAndUpdate(req.userId, { lookingFor, profileCompletionStep: 3 });
        res.json({ success: true, message: "Preference saved", nextStep: 4 });
    } catch (err) {
        res.status(500).json({ message: "Server error", success: false });
    }
});

// Generate bio based on intention
const generateBioFromIntention = (intention, name = "") => {
    const intros = [
        "Hey there! 👋",
        "Hello! 😊",
        "Hi! 👋",
        "Hey! 🌟",
        "Namaste! 🙏",
        "What's up! ✨"
    ];
    
    const lookingFor = {
        "Marriage": "I'm looking for a life partner for marriage. Ready to start a beautiful journey together! 💍",
        "Serious Relationship": "Seeking a meaningful serious relationship. Let's build something special! 💕",
        "Dating": "Looking to date and explore connections. Let's see where it goes! 😊",
        "Casual": "Here for casual dating and meeting new people. No pressure, just fun! 😎",
        "Friendship": "Interested in making genuine friends first. Good connections start with friendship! 🤝",
        "Not Sure Yet": "Just exploring and seeing what's out there. Open to possibilities! ✨"
    };
    
    const closings = [
        "Let's chat and get to know each other!",
        "Looking forward to connecting with you!",
        "Drop me a message if you're interested!",
        "Excited to meet new people here!"
    ];
    
    const intro = intros[Math.floor(Math.random() * intros.length)];
    const looking = lookingFor[intention] || lookingFor["Not Sure Yet"];
    const closing = closings[Math.floor(Math.random() * closings.length)];
    
    return `${intro} ${looking} ${closing}`;
};

// Save Intention
router.post("/intention", auth, async (req, res) => {
    try {
        const { intention } = req.body;
        if (!intention) return res.status(400).json({ message: "Required", success: false });
        
        // Get current user to check if bio exists
        const user = await User.findById(req.userId);
        
        // Only generate bio if user doesn't have one yet
        let updates = { intention, profileCompletionStep: 4 };
        if (!user.bio || user.bio === "") {
            updates.bio = generateBioFromIntention(intention, user.name);
        }
        
        await User.findByIdAndUpdate(req.userId, updates);
        res.json({ success: true, message: "Intention saved", nextStep: 5, autoBioGenerated: !user.bio });
    } catch (err) {
        res.status(500).json({ message: "Server error", success: false });
    }
});

// Save Bio
router.post("/bio", auth, async (req, res) => {
    try {
        const { bio } = req.body;
        if (!bio) return res.status(400).json({ message: "Required", success: false });
        await User.findByIdAndUpdate(req.userId, { bio, profileCompletionStep: 5 });
        res.json({ success: true, message: "Bio saved" });
    } catch (err) {
        res.status(500).json({ message: "Server error", success: false });
    }
});

// Save Photos (with ImageKit URLs)
router.post("/photos", auth, async (req, res) => {
    try {
        const { photos } = req.body; // [{ url, imagekitId }]
        if (!photos || photos.length === 0)
            return res.status(400).json({ message: "At least one photo required", success: false });

        const user = await User.findById(req.userId);
        const existing = user.profilePhotos || [];

        const newPhotos = photos.map((p, i) => ({
            url: p.url,
            imagekitId: p.imagekitId || "",
            isPrimary: existing.length === 0 && i === 0,
            order: existing.length + i,
        }));

        user.profilePhotos = [...existing, ...newPhotos];
        if (user.profileCompletionStep < 5) user.profileCompletionStep = 5;
        await user.save();

        res.json({ success: true, photos: user.profilePhotos });
    } catch (err) {
        res.status(500).json({ message: "Server error", success: false });
    }
});

// Delete a photo
router.delete("/photos/:imagekitId", auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const photoToDelete = user.profilePhotos.find(p => p.imagekitId === req.params.imagekitId);

        if (!photoToDelete) {
            return res.status(404).json({ message: "Photo not found", success: false });
        }

        // If deleting primary photo, set next photo as primary
        if (photoToDelete.isPrimary && user.profilePhotos.length > 1) {
            const remainingPhotos = user.profilePhotos.filter(p => p.imagekitId !== req.params.imagekitId);
            if (remainingPhotos.length > 0) {
                remainingPhotos[0].isPrimary = true;
            }
        }

        await User.findByIdAndUpdate(req.userId, {
            $pull: { profilePhotos: { imagekitId: req.params.imagekitId } },
        });

        // Reorder remaining photos
        const updatedUser = await User.findById(req.userId);
        updatedUser.profilePhotos = updatedUser.profilePhotos.map((photo, index) => ({
            ...photo,
            order: index
        }));
        await updatedUser.save();

        res.json({ success: true, message: "Photo deleted", photos: updatedUser.profilePhotos });
    } catch (err) {
        res.status(500).json({ message: "Server error", success: false });
    }
});

// Set primary photo
router.put("/photos/:imagekitId/primary", auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);

        // Reset all photos to non-primary
        user.profilePhotos.forEach(photo => {
            photo.isPrimary = false;
        });

        // Set selected photo as primary
        const selectedPhoto = user.profilePhotos.find(p => p.imagekitId === req.params.imagekitId);
        if (selectedPhoto) {
            selectedPhoto.isPrimary = true;
        } else {
            return res.status(404).json({ message: "Photo not found", success: false });
        }

        await user.save();
        res.json({ success: true, message: "Primary photo updated", photos: user.profilePhotos });
    } catch (err) {
        res.status(500).json({ message: "Server error", success: false });
    }
});

// Reorder photos
router.put("/photos/reorder", auth, async (req, res) => {
    try {
        const { photoIds } = req.body; // Array of imagekitIds in new order

        if (!photoIds || !Array.isArray(photoIds)) {
            return res.status(400).json({ message: "Invalid photo order", success: false });
        }

        const user = await User.findById(req.userId);
        const reorderedPhotos = [];

        photoIds.forEach((imagekitId, index) => {
            const photo = user.profilePhotos.find(p => p.imagekitId === imagekitId);
            if (photo) {
                photo.order = index;
                reorderedPhotos.push(photo);
            }
        });

        user.profilePhotos = reorderedPhotos;
        await user.save();

        res.json({ success: true, message: "Photos reordered", photos: user.profilePhotos });
    } catch (err) {
        res.status(500).json({ message: "Server error", success: false });
    }
});

// Complete profile
router.post("/complete", auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user.dateOfBirth || !user.state || !user.city || !user.gender || !user.lookingFor || !user.intention || !user.profilePhotos?.length)
            return res.status(400).json({ message: "Complete all steps first", success: false });

        const wasAlreadyComplete = user.isProfileComplete;

        user.isProfileComplete = true;
        user.profileCompletionStep = 6;
        await user.save();

        // Only schedule bot activity the very first time profile is completed
        if (!wasAlreadyComplete) {
            scheduleInitialActivity(user._id).catch(err =>
                console.error("[Profile] Failed to schedule bot activity:", err)
            );
        }

        res.json({ success: true, message: "Profile complete!" });
    } catch (err) {
        res.status(500).json({ message: "Server error", success: false });
    }
});

// Update profile
router.put("/update", auth, async (req, res) => {
    try {
        const { name, bio, ageRange, maxDistance, intention, lookingFor, personality, lifestyle, physical, beliefs } = req.body;
        const updates = {};
        if (name) updates.name = name;
        if (bio !== undefined) updates.bio = bio;
        if (ageRange) updates.ageRange = ageRange;
        if (maxDistance) updates.maxDistance = maxDistance;
        if (intention) updates.intention = intention;
        if (lookingFor) updates.lookingFor = lookingFor;

        // Handle nested profile details
        if (personality) updates.personality = { ...personality };
        if (lifestyle) updates.lifestyle = { ...lifestyle };
        if (physical) updates.physical = { ...physical };
        if (beliefs) updates.beliefs = { ...beliefs };

        updates.updatedAt = new Date();

        const user = await User.findByIdAndUpdate(req.userId, { $set: updates }, { new: true })
            .select("-password -otp -otpExpiry");
        res.json({ success: true, user });
    } catch (err) {
        console.error("Profile update error:", err);
        res.status(500).json({ message: "Server error", success: false });
    }
});

// Schedule account deletion (48 hour grace period)
router.post("/delete", auth, async (req, res) => {
    try {
        console.log(`[Profile] Scheduling deletion for user ${req.userId}`);

        const user = await User.findById(req.userId);

        // Check if already scheduled
        if (user.deletionRequestedAt) {
            const hoursRemaining = Math.ceil((48 * 60 * 60 * 1000 - (Date.now() - user.deletionRequestedAt.getTime())) / (60 * 60 * 1000));
            return res.json({
                success: true,
                message: `Your account is already scheduled for deletion. ${hoursRemaining} hours remaining.`,
                deletionRequestedAt: user.deletionRequestedAt,
                hoursRemaining
            });
        }

        // Set deletion request timestamp (but keep account active for 48 hours)
        await User.findByIdAndUpdate(req.userId, {
            deletionRequestedAt: new Date(),
            isDeactivated: false // Account stays visible until permanently deleted
        });

        res.json({
            success: true,
            message: "Deleting your account permanently takes 48 hours. If you change your mind, you can cancel the deletion request before 48 hours by logging back in.",
            deletionRequestedAt: new Date(),
            hoursRemaining: 48
        });
    } catch (err) {
        console.error("Deletion scheduling error:", err);
        res.status(500).json({ message: "Server error", success: false });
    }
});

// Cancel account deletion
router.post("/cancel-deletion", auth, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.userId, {
            deletionRequestedAt: null,
            isDeactivated: false
        });
        res.json({ success: true, message: "Account deletion cancelled" });
    } catch (err) {
        res.status(500).json({ message: "Server error", success: false });
    }
});

// ImageKit auth params
router.get("/imagekit-auth", auth, (req, res) => {
    const authParams = imagekit.getAuthenticationParameters();
    res.json(authParams);
});

module.exports = router;