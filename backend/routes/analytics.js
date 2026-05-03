const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const SessionHistory = require('../models/SessionHistory');

// POST /analytics/session
// Called by the app when user opens (start) or backgrounds (end) the app
router.post('/session', authMiddleware, async (req, res) => {
    try {
        const { action, durationSeconds } = req.body;
        const userId = req.user.id || req.user._id;

        console.log(`[SessionTracker] Action: ${action}, User: ${userId}, Duration: ${durationSeconds}`);

        if (!action || !['start', 'end'].includes(action)) {
            return res.status(400).json({ success: false, message: 'Invalid action. Must be start or end.' });
        }

        // Get today's date in YYYY-MM-DD (UTC to be consistent)
        const date = new Date().toISOString().split('T')[0];

        // Find or create today's history for the user
        let history = await SessionHistory.findOne({ userId, date });
        
        if (!history) {
            console.log(`[SessionTracker] Creating new record for ${date}`);
            history = new SessionHistory({ userId, date, loginCount: 0 });
        }

        if (action === 'start') {
            history.loginCount += 1;
            console.log(`[SessionTracker] Incremented loginCount to ${history.loginCount}`);
        }

        await history.save();
        res.json({ success: true, history });
    } catch (error) {
        console.error('Session tracking error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
