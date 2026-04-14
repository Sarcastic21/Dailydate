const express = require("express");
const router = express.Router();
const User = require("../models/User");
const ProfileView = require("../models/ProfileView");
const UserAction = require("../models/UserAction");
const Match = require("../models/Match");
const Message = require("../models/Message");
const Notification = require("../models/Notification");
const axios = require("axios");
const { State, City } = require("country-state-city");
const { redisConnection } = require("../queues/botQueue");
const bcrypt = require("bcryptjs");

const BOT_DEFAULT_PASSWORD = "bot_default_pass_123";

const generateBio = (intention) => {
    const intros = [
        "Hey there! 👋", "Hello! 😊", "Hi! 👋", "Hey! 🌟", "Namaste! 🙏", "What's up! ✨"
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

// Cleanup Redis keys for deleted user
const cleanupUserRedisKeys = async (userId) => {
    try {
        const engagementKey = `bot:engagement:${userId}`;
        const offlineKey = `bot:offline_engagement:${userId}`;
        const cancelledKey = `bot:cancelled:${userId}`;
        await redisConnection.del(engagementKey, offlineKey, cancelledKey);
    } catch (err) {
        console.error(`Failed to cleanup Redis for user ${userId}:`, err.message);
    }
};

// Upgrade Pinterest thumbnail URLs to maximum available quality (736x)
const upgradePinterestUrl = (url) => {
    if (!url || !url.includes('pinimg.com')) return url;
    // Replace known size segments like 236x, 474x, 75x75_RS, 170x, 345x, etc.
    return url.replace(/\/\d+x(\d+)?[^/]*\//, '/736x/');
};

// Helper function to download image from URL (works with Pinterest, etc.)
const downloadImage = async (rawUrl) => {
    const url = upgradePinterestUrl(rawUrl);
    if (url !== rawUrl) {
        console.log(`Upgraded Pinterest URL: ${rawUrl} → ${url}`);
    }
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
            'Referer': 'https://www.pinterest.com/',
        },
        timeout: 15000,
    });
    return Buffer.from(response.data);
};

const ALL_INDIAN_STATES = State.getStatesOfCountry("IN");
const INDIAN_STATE_NAMES = ALL_INDIAN_STATES.map(s => s.name);

const getRegionalLanguages = (stateName) => {
    const languages = ["Hindi"]; // Hindi confirmed as mandatory by user
    const state = stateName.toLowerCase();

    if (state.includes("west bengal")) languages.push("Bengali");
    if (state.includes("uttar pradesh") || state.includes("bihar")) languages.push("Bhojpuri");
    if (state.includes("tamil nadu")) {
        languages.push("Tamil");
        languages.push("Telugu"); // User specifically asked for Telugu in TN
    }
    if (state.includes("maharashtra")) languages.push("Marathi");
    if (state.includes("gujarat")) languages.push("Gujarati");
    if (state.includes("punjab")) languages.push("Punjabi");
    if (state.includes("karnataka")) languages.push("Kannada");
    if (state.includes("kerala")) languages.push("Malayalam");
    if (state.includes("odisha")) languages.push("Odia");
    if (state.includes("andhra") || state.includes("telangana")) languages.push("Telugu");

    // Add English often
    if (Math.random() < 0.8) languages.push("English");

    return [...new Set(languages)];
};

const generateRandomData = (gender, selectedState) => {
    let randomState;
    let randomCity = "";
    let stateCode = "";

    if (selectedState && selectedState !== "All States") {
        const foundState = ALL_INDIAN_STATES.find(s => s.name === selectedState);
        if (foundState) {
            randomState = foundState.name;
            stateCode = foundState.isoCode;
        } else {
            // Fallback
            randomState = ALL_INDIAN_STATES[0].name;
            stateCode = ALL_INDIAN_STATES[0].isoCode;
        }
    } else {
        const randomIndex = Math.floor(Math.random() * ALL_INDIAN_STATES.length);
        const s = ALL_INDIAN_STATES[randomIndex];
        randomState = s.name;
        stateCode = s.isoCode;
    }

    // Get cities for this state
    const citiesInState = City.getCitiesOfState("IN", stateCode);
    if (citiesInState && citiesInState.length > 0) {
        randomCity = citiesInState[Math.floor(Math.random() * citiesInState.length)].name;
    } else {
        randomCity = randomState; // Fallback to state name if no cities found
    }

    const intentions = ["Marriage", "Serious Relationship", "Dating", "Casual", "Friendship", "Not Sure Yet"];
    const lookingForOptions = gender === "male" ? ["female", "everyone"] : ["male", "everyone"];

    // Personality options
    const personalityTypes = ["Introvert", "Extrovert", "Ambivert", ""];

    // Lifestyle options
    const drinkingOptions = ["Never", "Occasionally", "Socially", "Frequently"];
    const smokingOptions = ["No", "Sometimes", "Yes"];
    const partyingOptions = ["Never", "Sometimes", "Often"];
    const workoutOptions = ["Regular", "Sometimes", "Never"];
    const dietOptions = ["Veg", "Non-veg", "Vegan"];

    // Beliefs options
    const nationalities = ["Indian", "NRI"];
    const wantKidsOptions = ["Yes", "No", "Maybe"];
    const longDistanceOptions = ["Yes", "No", "Maybe", ""];

    const intention = intentions[Math.floor(Math.random() * intentions.length)];

    return {
        state: randomState,
        city: randomCity,
        intention: intention,
        lookingFor: lookingForOptions[Math.floor(Math.random() * lookingForOptions.length)],
        bio: generateBio(intention),
        isVerified: true,
        dateOfBirth: {
            day: Math.floor(Math.random() * 28) + 1,
            month: Math.floor(Math.random() * 12) + 1,
            year: 1990 + Math.floor(Math.random() * 15),
            fullDate: new Date(1990 + Math.floor(Math.random() * 15), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1)
        },
        personality: {
            hobbies: Math.random() > 0.5 ? ["Traveling", "Reading", "Music"] : [],
            interests: Math.random() > 0.5 ? ["Photography", "Cooking", "Fitness"] : [],
            personalityType: personalityTypes[Math.floor(Math.random() * personalityTypes.length)],
            zodiac: "",
            education: "",
            profession: "",
            workIndustry: "",
        },
        lifestyle: {
            drinking: drinkingOptions[Math.floor(Math.random() * drinkingOptions.length)],
            smoking: smokingOptions[Math.floor(Math.random() * smokingOptions.length)],
            partying: partyingOptions[Math.floor(Math.random() * partyingOptions.length)],
            workout: workoutOptions[Math.floor(Math.random() * workoutOptions.length)],
            diet: dietOptions[Math.floor(Math.random() * dietOptions.length)],
        },
        physical: {
            height: "",
            weight: "",
            bodyType: ["Slim", "Athletic", "Average", "Heavy", ""][Math.floor(Math.random() * 5)],
            skinTone: "",
            hairType: "",
        },
        beliefs: {
            religion: "",
            caste: "",
            languages: getRegionalLanguages(randomState),
            nationality: nationalities[Math.floor(Math.random() * nationalities.length)],
            wantKids: wantKidsOptions[Math.floor(Math.random() * wantKidsOptions.length)],
            openToLongDistance: longDistanceOptions[Math.floor(Math.random() * longDistanceOptions.length)],
        },
        status: ["married", "single", "divorced", ""][Math.floor(Math.random() * 4)],
        accountType: Math.random() > 0.4 ? "gold" : "normal",
        isProfileComplete: true,
        profileCompletionStep: 5
    };
};

// Fetch users from randomuser.me API with batching for large counts
router.get("/fetch-random-users", async (req, res) => {
    try {
        console.log("🔍 fetch-random-users called with query:", req.query);

        const count = Math.min(parseInt(req.query.count) || 10, 1000); // Cap at 1000
        const gender = req.query.gender || "";
        const state = req.query.state || "";
        const minAge = parseInt(req.query.minAge) || 18;
        const maxAge = parseInt(req.query.maxAge) || 35;

        console.log("📊 Parsed params:", { count, gender, state, minAge, maxAge });

        // Batch size for API requests (randomuser.me works best with 100 max)
        const BATCH_SIZE = 100;
        const numBatches = Math.ceil(count / BATCH_SIZE);
        let allUsers = [];
        let failedBatches = 0;

        // Fetch users in batches
        for (let i = 0; i < numBatches && allUsers.length < count; i++) {
            const batchCount = Math.min(BATCH_SIZE, count - allUsers.length);
            let apiUrl = `https://randomuser.me/api/?nat=in&results=${batchCount}`;
            if (gender) {
                apiUrl += `&gender=${gender}`;
            }

            try {
                console.log(`Fetching batch ${i + 1}/${numBatches}: ${batchCount} users`);

                const response = await axios.get(apiUrl, {
                    timeout: 30000, // 30 second timeout
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'DailyDate Bot System'
                    }
                });

                if (!response.data || !response.data.results) {
                    console.error(`Batch ${i + 1}: Invalid response from API`);
                    failedBatches++;
                    continue;
                }

                const batchUsers = response.data.results.map((user, index) => {
                    const randomData = generateRandomData(user.gender, state);
                    const dob = new Date(user.dob.date);
                    const age = Math.floor((new Date() - dob) / (365.25 * 24 * 60 * 60 * 1000));

                    return {
                        tempId: allUsers.length + index,
                        name: `${user.name.first} ${user.name.last}`,
                        email: user.email,
                        gender: user.gender,
                        location: user.location,
                        dob: user.dob,
                        phone: user.phone,
                        picture: user.picture,
                        age: age,
                        ...randomData
                    };
                });

                allUsers = [...allUsers, ...batchUsers];
                console.log(`Batch ${i + 1}: Fetched ${batchUsers.length} users, total: ${allUsers.length}`);

                // Small delay between batches to avoid rate limiting
                if (i < numBatches - 1) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            } catch (batchError) {
                console.error(`Batch ${i + 1} failed:`, batchError.message);
                failedBatches++;
                // Continue with next batch instead of failing completely
            }
        }

        if (allUsers.length === 0) {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch users from external API. Please try again with a smaller count."
            });
        }

        // Filter users by state and age range if specified
        let filteredUsers = allUsers;
        if (state) {
            filteredUsers = filteredUsers.filter(user => user.state === state);
            console.log(`Filtered by state "${state}": ${filteredUsers.length} users remaining`);
        }
        if (minAge || maxAge) {
            filteredUsers = filteredUsers.filter(user => {
                if (minAge && user.age < minAge) return false;
                if (maxAge && user.age > maxAge) return false;
                return true;
            });
            console.log(`Filtered by age range ${minAge}-${maxAge}: ${filteredUsers.length} users remaining`);
        }

        // If we filtered out too many users, we need more - use yield-aware fetching
        const totalEvaluatedLimit = 5000;
        let totalEvaluated = allUsers.length;
        let additionalAttempts = 0;

        while (filteredUsers.length < count && totalEvaluated < totalEvaluatedLimit && additionalAttempts < 15) {
            additionalAttempts++;

            // Calculate current yield (filter pass rate)
            // If we have 0 users so far, assume 25% yield as a pessimistic starting point
            const currentYield = totalEvaluated > 0 ? (filteredUsers.length / totalEvaluated) : 0.25;
            const gap = count - filteredUsers.length;

            // Estimate how many we need to fetch to close the gap, plus 20% safety margin
            // Clamp between 50 and 500 per request
            let neededToFetch = Math.ceil((gap / Math.max(0.05, currentYield)) * 1.2);
            neededToFetch = Math.min(500, Math.max(50, neededToFetch));

            console.log(`Yield: ${(currentYield * 100).toFixed(1)}%. Gap: ${gap}. Fetching surplus: ${neededToFetch}`);

            let apiUrl = `https://randomuser.me/api/?nat=in&results=${neededToFetch}`;
            if (gender) apiUrl += `&gender=${gender}`;

            try {
                const response = await axios.get(apiUrl, {
                    timeout: 30000,
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'DailyDate Bot System'
                    }
                });

                if (!response.data || !response.data.results) break;

                const additionalUsers = response.data.results.map((user, index) => {
                    const randomData = generateRandomData(user.gender, state);
                    const dob = new Date(user.dob.date);
                    const age = Math.floor((new Date() - dob) / (365.25 * 24 * 60 * 60 * 1000));
                    return {
                        tempId: allUsers.length + index,
                        name: `${user.name.first} ${user.name.last}`,
                        email: user.email,
                        gender: user.gender,
                        location: user.location,
                        dob: user.dob,
                        phone: user.phone,
                        picture: user.picture,
                        age: age,
                        ...randomData
                    };
                });

                // Apply filters
                const additionalFiltered = additionalUsers.filter(user => {
                    if (state && user.state !== state) return false;
                    if (minAge && user.age < minAge) return false;
                    if (maxAge && user.age > maxAge) return false;
                    return true;
                });

                filteredUsers = [...filteredUsers, ...additionalFiltered];
                allUsers = [...allUsers, ...additionalUsers];
                totalEvaluated += additionalUsers.length;

                console.log(`Attempt ${additionalAttempts}: Fetched ${additionalUsers.length}, Passed: ${additionalFiltered.length}, Total Result: ${filteredUsers.length}`);

                // Small delay to prevent rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (err) {
                console.error(`Additional fetch attempt ${additionalAttempts} failed:`, err.message);
                break; // Stop if API is failing
            }
        }

        // Limit to requested count
        filteredUsers = filteredUsers.slice(0, count);

        console.log(`Final result: ${filteredUsers.length} users (${failedBatches} failed batches)`);

        res.json({
            success: true,
            users: filteredUsers,
            meta: {
                requested: count,
                returned: filteredUsers.length,
                failedBatches: failedBatches
            }
        });
    } catch (error) {
        console.error("❌ Error in fetch-random-users:", error);
        console.error("Error stack:", error.stack);

        // Check if it's an axios error
        if (error.response) {
            console.error("Axios response error:", {
                status: error.response.status,
                data: error.response.data
            });
        } else if (error.request) {
            console.error("Axios request error - no response received");
        }

        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch random users. Try a smaller count (50-100).",
            error: error.message
        });
    }
});

// Bulk insert bot users
router.post("/insert-bot-users", async (req, res) => {
    try {
        const { users } = req.body;

        if (!users || !Array.isArray(users)) {
            return res.status(400).json({ success: false, message: "Invalid users data" });
        }

        const ImageKit = require("imagekit");
        const imagekit = new ImageKit({
            publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
            privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
            urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
        });

        const insertedUsers = [];

        for (const userData of users) {
            // Generate email from name with special characters and random numbers
            const nameParts = userData.name.split(" ");
            const firstName = nameParts[0].toLowerCase().replace(/[^a-z]/g, "");
            const lastName = nameParts[1] ? nameParts[1].toLowerCase().replace(/[^a-z]/g, "") : "";
            const randomNum = Math.floor(Math.random() * 99);
            const uniqueEmail = `${firstName}.${lastName}${randomNum}@gmail.com`;

            // Process profile photos - download and upload to ImageKit for consistent quality
            const profilePhotos = [];
            let imageUrl = userData.customImage || (userData.picture && userData.picture.large);

            if (imageUrl) {
                try {
                    // Download image from URL first
                    console.log(`Downloading image from: ${imageUrl}`);
                    const imageBuffer = await downloadImage(imageUrl);
                    console.log(`Downloaded image, size: ${imageBuffer.length} bytes`);

                    // Upload to ImageKit using buffer
                    const timestamp = Date.now();
                    const randomSuffix = Math.random().toString(36).substring(2, 8);
                    const uploadResponse = await imagekit.upload({
                        file: imageBuffer,
                        fileName: `bot_${timestamp}_${randomSuffix}.jpg`,
                        folder: "/dailydate/bot-users",
                        useUniqueFileName: true,
                    });

                    profilePhotos.push({
                        url: uploadResponse.url,
                        imagekitId: uploadResponse.fileId,
                        isPrimary: true,
                        order: 0
                    });
                    console.log(`Successfully uploaded to ImageKit: ${uploadResponse.url}`);
                } catch (uploadError) {
                    console.error("Error downloading/uploading to ImageKit:", uploadError);
                    // Fallback to direct URL if download/upload fails
                    profilePhotos.push({
                        url: imageUrl,
                        imagekitId: "",
                        isPrimary: true,
                        order: 0
                    });
                }
            }

            // ── Sanitize enum fields so invalid values don't cause validation errors ──
            const VALID_INTENTIONS = ["Marriage", "Serious Relationship", "Dating", "Casual", "Friendship", "Not Sure Yet", ""];
            const VALID_LOOKING_FOR = ["male", "female", "everyone", ""];
            const VALID_STATUS = ["married", "single", "divorced", ""];
            const VALID_ACCOUNT_TYPES = ["normal", "gold"];

            const sanitizedIntention = VALID_INTENTIONS.includes(userData.intention) ? userData.intention : "";
            const sanitizedLookingFor = VALID_LOOKING_FOR.includes(userData.lookingFor) ? userData.lookingFor : "";

            let sanitizedAccountType = VALID_ACCOUNT_TYPES.includes(userData.accountType) ? userData.accountType : "gold";

            // Normal bots cannot interact, upgrade them to Gold
            if (sanitizedAccountType === "normal" || userData.accountType === "random") {
                sanitizedAccountType = "gold";
            }

            // Generate bio if not provided
            const finalBio = userData.bio || generateBio(sanitizedIntention);

            try {
                // Hash default password for bot users
                const hashedPassword = await bcrypt.hash(BOT_DEFAULT_PASSWORD, 10);

                const newUser = new User({
                    name: userData.name || "",
                    email: uniqueEmail,
                    password: hashedPassword,
                    userType: "bot",
                    status: "", // Skip filling status for bot users
                    gender: userData.gender || "",
                    state: userData.state || "",
                    city: userData.city || "",
                    dateOfBirth: userData.dateOfBirth || {},
                    lookingFor: sanitizedLookingFor,
                    intention: sanitizedIntention,
                    accountType: sanitizedAccountType,
                    ageRange: userData.ageRange || { min: 18, max: 35 },
                    maxDistance: userData.maxDistance || 50,
                    profilePhotos: profilePhotos,
                    bio: finalBio,
                    personality: userData.personality || {},
                    lifestyle: userData.lifestyle || {},
                    physical: userData.physical || {},
                    beliefs: userData.beliefs || {},
                    isProfileComplete: userData.isProfileComplete || false,
                    profileCompletionStep: userData.profileCompletionStep || 0,
                    isOnline: Math.random() > 0.5, // Random online status
                    lastActive: new Date(),
                    isVerified: true,
                    googleUser: false
                });

                const savedUser = await newUser.save();
                insertedUsers.push(savedUser);
            } catch (userSaveError) {
                console.error(`Error saving bot user ${userData.name}:`, userSaveError.message);
                // Continue to next user — don't fail the whole batch
            }
        }

        res.json({
            success: true,
            message: `Successfully inserted ${insertedUsers.length} bot users`,
            users: insertedUsers
        });
    } catch (error) {
        console.error("Error inserting bot users:", error);
        res.status(500).json({ success: false, message: "Failed to insert bot users" });
    }
});

// Get all bot users
router.get("/bot-users", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const botUsers = await User.find({ userType: "bot" })
            .select("-password -otp -otpExpiry")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await User.countDocuments({ userType: "bot" });

        res.json({
            success: true,
            users: botUsers,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Error fetching bot users:", error);
        res.status(500).json({ success: false, message: "Failed to fetch bot users" });
    }
});

// Get all real users (exclude pending deletion)
router.get("/real-users", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const query = {
            userType: "real",
            deletionRequestedAt: null // Exclude users pending deletion
        };

        const realUsers = await User.find(query)
            .select("-password -otp -otpExpiry")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await User.countDocuments(query);

        res.json({
            success: true,
            users: realUsers,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Error fetching real users:", error);
        res.status(500).json({ success: false, message: "Failed to fetch real users" });
    }
});

// Update a user (Admin)
router.put("/user/:userId", async (req, res) => {
    try {
        const { name, email, gender, state, city, accountType, isOnline } = req.body;
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (email !== undefined) updates.email = email;
        if (gender !== undefined) updates.gender = gender;
        if (state !== undefined) updates.state = state;
        if (city !== undefined) updates.city = city;
        if (accountType !== undefined) updates.accountType = accountType;
        if (isOnline !== undefined) updates.isOnline = isOnline;

        const user = await User.findByIdAndUpdate(req.params.userId, { $set: updates }, { new: true });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        res.json({ success: true, message: "User updated successfully", user });
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ success: false, message: "Failed to update user" });
    }
});

// Delete a user (bot or real)
router.delete("/user/:id", async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({ success: true, message: "User deleted successfully" });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ success: false, message: "Failed to delete user" });
    }
});

// Update bot user online status (for cron job)
router.post("/update-bot-online-status", async (req, res) => {
    try {
        // Randomly update isOnline status for bot users
        const botUsers = await User.find({ userType: "bot" });

        const updatePromises = botUsers.map(async (user) => {
            const isOnline = Math.random() < 0.7; // 70% chance to be online
            return User.findByIdAndUpdate(user._id, {
                isOnline: isOnline,
                lastActive: isOnline ? new Date() : user.lastActive
            });
        });

        await Promise.all(updatePromises);

        res.json({
            success: true,
            message: `Updated online status for ${botUsers.length} bot users`
        });
    } catch (error) {
        console.error("Error updating bot online status:", error);
        res.status(500).json({ success: false, message: "Failed to update bot online status" });
    }
});

// Get comprehensive analytics for dashboard (exclude pending deletion)
router.get("/analytics", async (req, res) => {
    try {
        // Base query to exclude users pending deletion
        const activeRealUserQuery = { userType: "real", deletionRequestedAt: null };

        const [
            totalBots,
            totalReal,
            onlineReal,
            onlineBots,
            premiumUsers,
            goldBots,
            goldUsers,
            maleUsers,
            femaleUsers,
            usersByState,
            pendingDeletionCount,
            deactivatedUsers
        ] = await Promise.all([
            User.countDocuments({ userType: "bot" }),
            User.countDocuments(activeRealUserQuery),
            User.countDocuments({ ...activeRealUserQuery, isOnline: true }),
            User.countDocuments({ userType: "bot", isOnline: true }),
            User.countDocuments({ ...activeRealUserQuery, accountType: { $ne: "normal" } }),
            User.countDocuments({ userType: "bot", accountType: "gold" }),
            User.countDocuments({ ...activeRealUserQuery, accountType: "gold" }),
            User.countDocuments({ ...activeRealUserQuery, gender: "male" }),
            User.countDocuments({ ...activeRealUserQuery, gender: "female" }),
            User.aggregate([
                { $match: { ...activeRealUserQuery, state: { $ne: "" } } },
                { $group: { _id: "$state", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]),
            User.countDocuments({ userType: "real", deletionRequestedAt: { $ne: null } }),
            User.countDocuments({ isDeactivated: true })
        ]);

        // Get recent activity stats (last 24 hours)
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [
            newUsersToday,
            activeUsersToday
        ] = await Promise.all([
            User.countDocuments({ ...activeRealUserQuery, createdAt: { $gte: yesterday } }),
            User.countDocuments({ ...activeRealUserQuery, lastActive: { $gte: yesterday } })
        ]);

        res.json({
            success: true,
            analytics: {
                totalBots,
                totalReal,
                onlineReal,
                onlineBots,
                premiumUsers,
                goldBots,
                goldUsers,
                maleUsers,
                femaleUsers,
                newUsersToday,
                activeUsersToday,
                usersByState,
                pendingDeletionCount,
                deactivatedUsers
            }
        });
    } catch (error) {
        console.error("Error fetching analytics:", error);
        res.status(500).json({ success: false, message: "Failed to fetch analytics" });
    }
});

// Get list of Indian states for dropdowns
router.get("/states", async (req, res) => {
    try {
        res.json({
            success: true,
            states: INDIAN_STATE_NAMES
        });
    } catch (error) {
        console.error("Error fetching states:", error);
        res.status(500).json({ success: false, message: "Failed to fetch states" });
    }
});

// Get detailed analytics with time range
router.get("/detailed-analytics", async (req, res) => {
    try {
        const { range = '7days' } = req.query;
        const now = new Date();
        let startDate;

        switch (range) {
            case '24hours':
                startDate = new Date(now - 24 * 60 * 60 * 1000);
                break;
            case '7days':
                startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30days':
                startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
                break;
            case '90days':
                startDate = new Date(now - 90 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
        }

        const activeRealUserQuery = { userType: "real", deletionRequestedAt: null };

        // User growth data for charts
        const userGrowth = await User.aggregate([
            { $match: { ...activeRealUserQuery, createdAt: { $gte: startDate } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } },
            { $project: { date: "$_id", count: 1, _id: 0 } }
        ]);

        // Hourly activity data
        const hourlyActivity = await User.aggregate([
            { $match: { lastActive: { $gte: new Date(now - 24 * 60 * 60 * 1000) } } },
            {
                $group: {
                    _id: { $hour: "$lastActive" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } },
            { $project: { hour: "$_id", count: 1, _id: 0 } }
        ]);

        // Daily activity stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [dailyActivity, newUsersThisWeek, activeChats, expiringSoon] = await Promise.all([
            // Get today's activity counts from ProfileView, UserAction, Match, Message models
            Promise.all([
                ProfileView.countDocuments({ viewedAt: { $gte: today } }),
                UserAction.countDocuments({ timestamp: { $gte: today }, actionType: "like" }),
                Match.countDocuments({ matchedAt: { $gte: today } }),
                Message.countDocuments({ createdAt: { $gte: today } })
            ]).then(([views, likes, matches, messages]) => ({ views, likes, matches, messages })),

            // New users this week
            User.countDocuments({ ...activeRealUserQuery, createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } }),

            // Active chats (matches with recent messages)
            Match.countDocuments({
                status: "matched",
                updatedAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) }
            }),

            // Subscriptions expiring in next 7 days
            User.countDocuments({
                ...activeRealUserQuery,
                accountType: { $ne: "normal" },
                subscriptionExpiry: { $gte: now, $lte: new Date(now + 7 * 24 * 60 * 60 * 1000) }
            })
        ]);

        // Get recent users list
        const users = await User.find({ userType: { $in: ["real", "bot"] } })
            .sort({ createdAt: -1 })
            .limit(50)
            .select("name email userType isOnline accountType createdAt lastActive profilePhotos isDeactivated");

        // Subscription breakdown
        const subscriptionBreakdown = await User.aggregate([
            { $match: { ...activeRealUserQuery, accountType: { $ne: "normal" } } },
            { $group: { _id: "$accountType", count: { $sum: 1 } } },
            { $project: { tier: "$_id", count: 1, _id: 0 } }
        ]);

        // Get active subscriptions with user details
        const subscriptions = await User.find({
            ...activeRealUserQuery,
            accountType: { $ne: "normal" },
            subscriptionExpiry: { $gte: now }
        })
            .select("name email accountType subscriptionStart subscriptionExpiry subscriptionRenewal profilePhotos")
            .sort({ subscriptionExpiry: 1 })
            .limit(50);

        // Calculate reports
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        const weekStart = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const monthStart = new Date(now - 30 * 24 * 60 * 60 * 1000);

        const [dailyReport, weeklyReport, monthlyReport] = await Promise.all([
            {
                newUsers: await User.countDocuments({ ...activeRealUserQuery, createdAt: { $gte: dayStart } }),
                views: dailyActivity.views,
                likes: dailyActivity.likes,
                matches: dailyActivity.matches
            },
            {
                newUsers: await User.countDocuments({ ...activeRealUserQuery, createdAt: { $gte: weekStart } }),
                activeUsers: await User.countDocuments({ ...activeRealUserQuery, lastActive: { $gte: weekStart } }),
                premiumSignups: await User.countDocuments({ ...activeRealUserQuery, accountType: { $ne: "normal" }, subscriptionStart: { $gte: weekStart } })
            },
            {
                newUsers: await User.countDocuments({ ...activeRealUserQuery, createdAt: { $gte: monthStart } }),
                revenue: await User.countDocuments({ ...activeRealUserQuery, accountType: { $ne: "normal" } }) * 299, // approximate
                retention: 75 // placeholder calculation
            }
        ]);

        // Get deactivated users count
        const deactivatedUsers = await User.countDocuments({ isDeactivated: true });

        res.json({
            success: true,
            stats: {
                userGrowth,
                hourlyActivity,
                dailyActivity,
                newUsersThisWeek,
                activeChats,
                expiringSoon,
                users,
                subscriptionBreakdown,
                subscriptions: subscriptions.map(s => ({
                    _id: s._id,
                    user: {
                        name: s.name,
                        email: s.email,
                        profilePhotos: s.profilePhotos
                    },
                    tier: s.accountType,
                    startDate: s.subscriptionStart,
                    expiryDate: s.subscriptionExpiry,
                    renewalDate: s.subscriptionRenewal,
                    status: s.subscriptionExpiry > now ? 'active' : 'expired'
                })),
                dailyReport,
                weeklyReport,
                monthlyReport,
                deactivatedUsers,
                growthRate: 12.5 // calculated value
            }
        });
    } catch (error) {
        console.error("Error fetching detailed analytics:", error);
        res.status(500).json({ success: false, message: "Failed to fetch detailed analytics" });
    }
});

// Deactivate user
router.post("/user/:id/deactivate", async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isDeactivated: true, deactivatedAt: new Date() },
            { new: true }
        );
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.json({ success: true, message: "User deactivated successfully" });
    } catch (error) {
        console.error("Error deactivating user:", error);
        res.status(500).json({ success: false, message: "Failed to deactivate user" });
    }
});

// Restore deactivated user
router.post("/user/:id/restore", async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isDeactivated: false, deactivatedAt: null, deletionRequestedAt: null },
            { new: true }
        );
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.json({ success: true, message: "User restored successfully" });
    } catch (error) {
        console.error("Error restoring user:", error);
        res.status(500).json({ success: false, message: "Failed to restore user" });
    }
});

// Delete user permanently
router.delete("/user/:id", async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Clean up Redis keys for bot engagement
        await cleanupUserRedisKeys(req.params.id);

        // Clean up related data
        await Promise.all([
            ProfileView.deleteMany({ $or: [{ viewerId: req.params.id }, { targetUserId: req.params.id }] }),
            UserAction.deleteMany({ $or: [{ userId: req.params.id }, { targetUserId: req.params.id }] }),
            Match.deleteMany({ $or: [{ user1Id: req.params.id }, { user2Id: req.params.id }] }),
            Message.deleteMany({ $or: [{ senderId: req.params.id }, { receiverId: req.params.id }] }),
            Notification.deleteMany({ userId: req.params.id })
        ]);
        res.json({ success: true, message: "User deleted permanently" });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ success: false, message: "Failed to delete user" });
    }
});

module.exports = router;
