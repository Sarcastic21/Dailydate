const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const otpGenerator = require("otp-generator");
const User = require("../models/User");
const redisClient = require("../config/redis");
const { scheduleInitialActivity } = require("../services/botInteractionService");
const { getAdmin } = require("../config/firebaseAdmin");

const router = express.Router();

// Helper to detect email vs phone
const isEmail = (identifier) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
const isPhone = (identifier) => /^\+?\d{10,15}$/.test(identifier.replace(/[\s\-\(\)]/g, ""));

const normalizeIdentifier = (identifier) => {
    if (!identifier) return identifier;
    const trimmed = identifier.trim();
    if (isEmail(trimmed)) {
        return trimmed.toLowerCase();
    }
    // Handle phone
    let phone = trimmed.replace(/[\s\-\(\)]/g, ""); 
    if (/^\d{10}$/.test(phone)) {
        return `+91${phone}`;
    }
    if (phone.startsWith("0") && phone.length === 11) {
        return `+91${phone.substring(1)}`;
    }
    if (/^\d{11,14}$/.test(phone)) {
        return `+${phone}`;
    }
    return phone;
};

const generateToken = (userId) =>
    jwt.sign({ userId }, process.env.JWT_SECRET || "dailydate_secret", { expiresIn: "30d" });

// Nodemailer transporter with enhanced timeout and logging
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    tls: {
        rejectUnauthorized: false
    },
    connectionTimeout: 20000, // Increased to 20s for Render
    greetingTimeout: 15000,
    socketTimeout: 30000,
    logger: true, // Log to Render console
    debug: true
});
const sendOtpEmail = async (email, otp) => {
    const mailOptions = {
        from: `DailyDate <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "DailyDate - Email Verification Code",
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.04);">
                <!-- Minimal Header -->
                <div style="padding: 32px 32px 0 32px;">
                    <span style="font-size: 20px; font-weight: 600; color: #E8622E; letter-spacing: -0.3px;">DailyDate</span>
                </div>
                
                <!-- Content -->
                <div style="padding: 24px 32px 32px 32px;">
                    <h1 style="font-size: 26px; font-weight: 500; color: #1A1A1A; margin: 0 0 12px 0; letter-spacing: -0.5px;">Verification code</h1>
                    <p style="font-size: 16px; color: #5E5E5E; line-height: 1.5; margin: 0 0 32px 0;">Please use the following code to complete your registration. This code expires in 5 minutes.</p>
                    
                    <!-- OTP -->
                    <div style="background: #F8F8F8; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
                        <span style="font-size: 48px; font-weight: 500; letter-spacing: 8px; color: #E8622E; font-family: monospace;">${otp}</span>
                    </div>
                    
                    <p style="font-size: 14px; color: #8E8E8E; margin: 0 0 8px 0;">Didn't request this? You can safely ignore this email.</p>
                    <p style="font-size: 14px; color: #8E8E8E; margin: 0;">— The DailyDate Team</p>
                </div>
                
                <!-- Divider -->
                <div style="height: 1px; background: #EEEEEE; margin: 0 32px;"></div>
                
                <!-- Footer -->
                <div style="padding: 24px 32px 32px 32px;">
                    <p style="font-size: 12px; color: #AAAAAA; margin: 0;">© 2026 DailyDate. All rights reserved.</p>
                </div>
            </div>
        `,
    };
    await transporter.sendMail(mailOptions);
};

// ─── REGISTER (Send OTP Only) ──────────────────────────────
router.post("/register", async (req, res) => {
    try {
        const { identifier } = req.body;
        if (!identifier)
            return res.status(400).json({ message: "Email or phone is required", success: false });

        const emailMode = isEmail(identifier);
        const normalized = normalizeIdentifier(identifier);
        
        let existingUser;
        if (emailMode) {
            existingUser = await User.findOne({ email: normalized });
        } else {
            existingUser = await User.findOne({ phone: normalized });
        }

        if (existingUser && existingUser.isVerified)
            return res.status(400).json({ message: "User already exists", success: false });

        if (emailMode) {
            const otp = otpGenerator.generate(6, { upperCaseAlphabets: false, lowerCaseAlphabets: false, specialChars: false });
            try {
                await sendOtpEmail(identifier, otp);
                await redisClient.setEx(`otp:${identifier.toLowerCase()}`, 300, otp);
                console.log(`OTP email sent and stored in Redis for ${identifier}`);
                return res.status(200).json({ message: "OTP sent to your email", success: true, mode: "email" });
            } catch (emailError) {
                console.error("CRITICAL: Failed to send OTP during registration:", emailError);
                return res.status(500).json({ message: "Email service temporarily unavailable.", success: false });
            }
        } else {
            // For phone, we allow them to proceed as SMS is handled by client-side Firebase
            return res.status(200).json({ message: "Please verify mobile OTP via Firebase", success: true, mode: "phone" });
        }
    } catch (error) {
        console.error("Register error:", error);
        res.status(500).json({ message: "Server error", success: false });
    }
});

// ─── VERIFY OTP & REGISTER ─────────────────────────────────
router.post("/verify-otp", async (req, res) => {
    try {
        const { name, identifier, password, otp, idToken } = req.body;
        if (!name || !identifier || !password) {
            return res.status(400).json({ message: "Missing required fields", success: false });
        }

        let verifiedIdentifier = normalizeIdentifier(identifier);
        const emailMode = isEmail(identifier);

        if (emailMode) {
            if (!otp) return res.status(400).json({ message: "OTP is required for email verification", success: false });
            const storedOtp = await redisClient.get(`otp:${verifiedIdentifier}`);
            if (!storedOtp) return res.status(400).json({ message: "OTP has expired or not found", success: false });
            if (storedOtp !== otp) return res.status(400).json({ message: "Invalid OTP", success: false });
            await redisClient.del(`otp:${verifiedIdentifier}`);
        } else {
            // Firebase Token Verification for Phone
            if (!idToken) return res.status(400).json({ message: "Firebase ID token is required for phone verification", success: false });
            const admin = getAdmin();
            if (!admin) return res.status(500).json({ message: "Firebase service unavailable", success: false });
            
            try {
                const decodedToken = await admin.auth().verifyIdToken(idToken);
                verifiedIdentifier = decodedToken.phone_number;
                if (!verifiedIdentifier) {
                  return res.status(400).json({ message: "Mobile number not found in token", success: false });
                }
            } catch (err) {
                console.error("Firebase token verification failed:", err.message);
                return res.status(401).json({ message: "Invalid or expired Firebase token", success: false });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Clean up unverified user if exists
        if (emailMode) {
            await User.deleteOne({ email: verifiedIdentifier, isVerified: false });
        } else {
            await User.deleteOne({ phone: verifiedIdentifier, isVerified: false });
        }

        const user = await User.create({
            name,
            email: emailMode ? verifiedIdentifier : undefined,
            phone: !emailMode ? verifiedIdentifier : undefined,
            password: hashedPassword,
            isVerified: true
        });

        const token = generateToken(user._id);
        res.status(200).json({
            message: "Registration successful",
            success: true,
            token,
            user: { id: user._id, name: user.name, email: user.email, phone: user.phone, isProfileComplete: user.isProfileComplete },
        });
    } catch (error) {
        console.error("Verify OTP error:", error);
        res.status(500).json({ message: "Server error", success: false });
    }
});

// ─── LOGIN ──────────────────────────────────────────────────
router.post("/login", async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password)
            return res.status(400).json({ message: "All fields are required", success: false });

        let user;
        const normalized = normalizeIdentifier(identifier);
        if (isEmail(identifier)) {
            user = await User.findOne({ email: normalized });
        } else {
            user = await User.findOne({ phone: normalized });
        }

        if (!user) return res.status(400).json({ message: "User not found", success: false });
        if (!user.isVerified) return res.status(400).json({ message: "Please verify your account first", success: false });
        if (!user.password) return res.status(400).json({ message: "Please set a password first", success: false });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials", success: false });

        user.lastActive = new Date();
        await user.save();

        const token = generateToken(user._id);
        res.status(200).json({
            message: "Login successful",
            success: true,
            token,
            user: { id: user._id, name: user.name, email: user.email, phone: user.phone, isProfileComplete: user.isProfileComplete },
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Server error", success: false });
    }
});

// ─── FORGOT PASSWORD ────────────────────────────────────────
router.post("/forgot-password", async (req, res) => {
    try {
        const { identifier } = req.body;
        if (!identifier) return res.status(400).json({ message: "Email or phone is required", success: false });

        const emailMode = isEmail(identifier);
        const normalized = normalizeIdentifier(identifier);
        let user;
        if (emailMode) {
            user = await User.findOne({ email: normalized });
        } else {
            user = await User.findOne({ phone: normalized });
        }

        if (!user) return res.status(400).json({ message: "User not found", success: false });

        if (emailMode) {
            const otp = otpGenerator.generate(6, { upperCaseAlphabets: false, lowerCaseAlphabets: false, specialChars: false });
            user.otp = otp;
            user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
            await user.save();
            await sendOtpEmail(identifier, otp);
            res.status(200).json({ message: "OTP sent to your email", success: true, mode: "email" });
        } else {
            // For phone, frontend will handle sending OTP via Firebase. 
            // We just confirm the user exists.
            res.status(200).json({ message: "Please verify mobile OTP via Firebase", success: true, mode: "phone" });
        }
    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({ message: "Server error", success: false });
    }
});

// ─── RESET PASSWORD ─────────────────────────────────────────
router.post("/reset-password", async (req, res) => {
    try {
        const { identifier, otp, idToken, newPassword } = req.body;
        if (!identifier || !newPassword) return res.status(400).json({ message: "Missing required fields", success: false });

        const emailMode = isEmail(identifier);
        const normalized = normalizeIdentifier(identifier);
        let user;
        if (emailMode) {
            user = await User.findOne({ email: normalized });
            if (!user) return res.status(400).json({ message: "User not found", success: false });
            if (user.otp !== otp) return res.status(400).json({ message: "Invalid OTP", success: false });
            if (user.otpExpiry < new Date()) return res.status(400).json({ message: "OTP has expired", success: false });
        } else {
            // Phone reset via Firebase token
            if (!idToken) return res.status(400).json({ message: "Firebase ID token required", success: false });
            const admin = getAdmin();
            try {
                const decodedToken = await admin.auth().verifyIdToken(idToken);
                const phone = decodedToken.phone_number;
                user = await User.findOne({ phone });
                if (!user) return res.status(400).json({ message: "User with this phone not found", success: false });
            } catch (err) {
                return res.status(401).json({ message: "Invalid Firebase token", success: false });
            }
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.otp = "";
        user.otpExpiry = null;
        await user.save();

        res.status(200).json({ message: "Password reset successfully", success: true });
    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ message: "Server error", success: false });
    }
});

// ─── GOOGLE SIGN-IN ─────────────────────────────────────────
router.post("/google-signin", async (req, res) => {
    try {
        const { email, name } = req.body;
        if (!email) return res.status(400).json({ message: "Email is required", success: false });

        let user = await User.findOne({ email });
        if (!user) {
            user = await User.create({ name: name || "", email, googleUser: true, isVerified: true });
            // Bot activity will be triggered when the user completes onboarding
        }

        user.lastActive = new Date();

        await user.save();

        const needsPassword = user.googleUser && !user.password;
        const token = generateToken(user._id);
        res.status(200).json({
            message: "Google sign-in successful",
            success: true,
            token,
            user: { id: user._id, name: user.name, email: user.email, isProfileComplete: user.isProfileComplete },
            needsPassword,
        });
    } catch (error) {
        console.error("Google sign-in error:", error);
        res.status(500).json({ message: "Server error", success: false });
    }
});

// ─── SET PASSWORD ────────────────────────────────────────────
router.post("/set-password", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ message: "All fields are required", success: false });

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "User not found", success: false });

        user.password = await bcrypt.hash(password, 10);
        await user.save();

        const token = generateToken(user._id);
        res.status(200).json({
            message: "Password set successfully",
            success: true,
            token,
            user: { id: user._id, name: user.name, email: user.email, isProfileComplete: user.isProfileComplete },
        });
    } catch (error) {
        console.error("Set password error:", error);
        res.status(500).json({ message: "Server error", success: false });
    }
});

// ─── CHANGE PASSWORD (for logged-in users) ───────────────────
const auth = require("../middleware/auth");
router.post("/change-password", auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword)
            return res.status(400).json({ message: "Current and new password required", success: false });

        if (newPassword.length < 6)
            return res.status(400).json({ message: "New password must be at least 6 characters", success: false });

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: "User not found", success: false });
        if (!user.password) return res.status(400).json({ message: "Google users must set password first", success: false });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ message: "Current password is incorrect", success: false });

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.status(200).json({ message: "Password changed successfully", success: true });
    } catch (error) {
        console.error("Change password error:", error);
        res.status(500).json({ message: "Server error", success: false });
    }
});

module.exports = router;