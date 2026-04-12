// middleware/auth.js - CREATE THIS FILE
const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async (req, res, next) => {
    try {
        const token = req.header("Authorization")?.replace("Bearer ", "");

        if (!token) {
            return res.status(401).json({ message: "No token provided", success: false });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_secret_key");
        const user = await User.findById(decoded.userId).select("-password -otp -otpExpiry");

        if (!user) {
            return res.status(401).json({ message: "User not found", success: false });
        }

        req.user = user;
        req.userId = user._id;

        // Update lastActive timestamp asynchronously (don't block the request)
        User.findByIdAndUpdate(user._id, { lastActive: new Date() }).catch(err => console.error("Update lastActive error:", err));

        next();
    } catch (error) {
        console.error("Auth error:", error);
        res.status(401).json({ message: "Invalid token", success: false });
    }
};