const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

module.exports = async (req, res, next) => {
    try {
        const token = req.header("Authorization")?.replace("Bearer ", "");

        if (!token) {
            return res.status(401).json({ message: "No admin token provided", success: false });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || "dailydate_secret");
        
        // Ensure the token belongs to an admin and not a regular user
        if (!decoded.isAdmin) {
            return res.status(403).json({ message: "Access denied. Admin privileges required.", success: false });
        }

        const admin = await Admin.findById(decoded.adminId);

        if (!admin) {
            return res.status(401).json({ message: "Admin not found", success: false });
        }

        req.admin = admin;
        req.adminId = admin._id;

        next();
    } catch (error) {
        console.error("Admin Auth error:", error);
        res.status(401).json({ message: "Invalid or expired admin token", success: false });
    }
};
