const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

const generateToken = (adminId) =>
    jwt.sign({ adminId, isAdmin: true }, process.env.JWT_SECRET || "dailydate_secret", { expiresIn: "7d" });

// Admin Login
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required", success: false });
        }

        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(401).json({ message: "Invalid admin credentials", success: false });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid admin credentials", success: false });
        }

        const token = generateToken(admin._id);
        res.status(200).json({
            message: "Admin login successful",
            success: true,
            token,
            admin: { id: admin._id, email: admin.email, role: admin.role }
        });
    } catch (error) {
        console.error("Admin Login Error:", error);
        res.status(500).json({ message: "Server error", success: false });
    }
});

module.exports = router;
