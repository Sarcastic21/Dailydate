const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const otpGenerator = require("otp-generator");
const User = require("../models/User");
const { scheduleInitialActivity } = require("../services/botInteractionService");

const router = express.Router();

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
        subject: "DailyDate - Your OTP Code",
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center; background: #FFF5F7;">
                <h2 style="color: #FF6B8B;">💕 DailyDate</h2>
                <p style="color: #555;">Your OTP code is:</p>
                <h1 style="color: #FF6B8B; letter-spacing: 8px; background: #FFE4E9; padding: 15px; border-radius: 10px;">${otp}</h1>
                <p style="color: #999;">This code expires in 5 minutes.</p>
            </div>
        `,
    };
    await transporter.sendMail(mailOptions);
};

// ─── REGISTER ───────────────────────────────────────────────
router.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password)
            return res.status(400).json({ message: "All fields are required", success: false });

        const existingUser = await User.findOne({ email });
        if (existingUser && existingUser.isVerified)
            return res.status(400).json({ message: "User already exists", success: false });

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = otpGenerator.generate(6, { upperCaseAlphabets: false, lowerCaseAlphabets: false, specialChars: false });
        const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

        // TRANSACTIONAL APPROACH: Send email BEFORE saving user to DB
        // This prevents polluting the DB with unverified accounts that can't be registered again if email fails.
        try {
            await sendOtpEmail(email, otp);
            console.log(`OTP email sent successfully to ${email}`);
        } catch (emailError) {
            console.error("CRITICAL: Failed to send OTP during registration:", emailError);
            return res.status(500).json({
                message: "Email service is temporarily unavailable. Please try again in a few minutes.",
                success: false,
                details: emailError.message
            });
        }

        if (existingUser && !existingUser.isVerified) {
            existingUser.name = name;
            existingUser.password = hashedPassword;
            existingUser.otp = otp;
            existingUser.otpExpiry = otpExpiry;
            await existingUser.save();
        } else {
            await User.create({ name, email, password: hashedPassword, otp, otpExpiry });
        }

        res.status(200).json({ message: "OTP sent to your email", success: true });
    } catch (error) {
        console.error("Register database error:", error);
        res.status(500).json({ message: "Server error", success: false });
    }
});

// ─── VERIFY OTP ─────────────────────────────────────────────
router.post("/verify-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "User not found", success: false });
        if (user.otp !== otp) return res.status(400).json({ message: "Invalid OTP", success: false });
        if (user.otpExpiry < new Date()) return res.status(400).json({ message: "OTP has expired", success: false });

        user.isVerified = true;
        user.otp = "";
        user.otpExpiry = null;

        await user.save();

        const token = generateToken(user._id);
        res.status(200).json({
            message: "Email verified successfully",
            success: true,
            token,
            user: { id: user._id, name: user.name, email: user.email, isProfileComplete: user.isProfileComplete },
        });
    } catch (error) {
        console.error("Verify OTP error:", error);
        res.status(500).json({ message: "Server error", success: false });
    }
});

// ─── LOGIN ──────────────────────────────────────────────────
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ message: "All fields are required", success: false });

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "User not found", success: false });
        if (!user.isVerified) return res.status(400).json({ message: "Please verify your email first", success: false });
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
            user: { id: user._id, name: user.name, email: user.email, isProfileComplete: user.isProfileComplete },
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Server error", success: false });
    }
});

// ─── FORGOT PASSWORD ────────────────────────────────────────
router.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "User not found", success: false });

        const otp = otpGenerator.generate(6, { upperCaseAlphabets: false, lowerCaseAlphabets: false, specialChars: false });
        user.otp = otp;
        user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
        await user.save();

        await sendOtpEmail(email, otp);
        res.status(200).json({ message: "OTP sent to your email", success: true });
    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({ message: "Server error", success: false });
    }
});

// ─── RESET PASSWORD ─────────────────────────────────────────
router.post("/reset-password", async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "User not found", success: false });
        if (user.otp !== otp) return res.status(400).json({ message: "Invalid OTP", success: false });
        if (user.otpExpiry < new Date()) return res.status(400).json({ message: "OTP has expired", success: false });

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