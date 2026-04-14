const express = require('express');
const router = express.Router();
const Pricing = require('../models/Pricing');
const auth = require('../middleware/auth');

// Get all pricing plans (public endpoint)
router.get('/plans', async (req, res) => {
    try {
        const plans = await Pricing.find({ isActive: true }).sort({ durationMonths: 1 });
        res.json({
            success: true,
            plans: plans.map(plan => ({
                id: plan._id,
                tier: plan.tier,
                durationMonths: plan.durationMonths,
                originalPrice: plan.originalPrice,
                discountedPrice: plan.discountedPrice,
                discountPercentage: plan.discountPercentage,
                monthlyPrice: plan.monthlyPrice,
                amountPaise: plan.amountPaise,
                label: plan.label,
                badge: plan.badge,
                badgeEmoji: plan.badgeEmoji,
                isActive: plan.isActive,
                banner: plan.banner.isActive ? plan.banner : null
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single pricing plan by ID (public endpoint)
router.get('/plans/:id', async (req, res) => {
    try {
        const plan = await Pricing.findOne({ _id: req.params.id, isActive: true });
        if (!plan) {
            return res.status(404).json({ success: false, error: 'Plan not found' });
        }
        res.json({
            success: true,
            plan: {
                id: plan._id,
                tier: plan.tier,
                durationMonths: plan.durationMonths,
                originalPrice: plan.originalPrice,
                discountedPrice: plan.discountedPrice,
                discountPercentage: plan.discountPercentage,
                monthlyPrice: plan.monthlyPrice,
                amountPaise: plan.amountPaise,
                label: plan.label,
                badge: plan.badge,
                badgeEmoji: plan.badgeEmoji,
                isActive: plan.isActive,
                banner: plan.banner.isActive ? plan.banner : null
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin: Get all pricing plans (including inactive)
router.get('/admin/plans', async (req, res) => {
    try {

        const plans = await Pricing.find().sort({ durationMonths: 1 });
        res.json({
            success: true,
            plans
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin: Create new pricing plan
router.post('/admin/plans', async (req, res) => {
    try {

        const {
            tier,
            durationMonths,
            originalPrice,
            discountedPrice,
            label,
            badge,
            badgeEmoji,
            banner
        } = req.body;

        // Check if plan already exists
        const existingPlan = await Pricing.findOne({ tier, durationMonths });
        if (existingPlan) {
            return res.status(400).json({ success: false, error: 'Plan already exists for this tier and duration' });
        }

        const plan = new Pricing({
            tier,
            durationMonths,
            originalPrice,
            discountedPrice,
            label,
            badge,
            badgeEmoji,
            banner
        });

        await plan.save();
        res.status(201).json({ success: true, plan });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin: Update pricing plan
router.put('/admin/plans/:id', async (req, res) => {
    try {

        const {
            originalPrice,
            discountedPrice,
            label,
            badge,
            badgeEmoji,
            banner,
            isActive
        } = req.body;

        const plan = await Pricing.findByIdAndUpdate(
            req.params.id,
            {
                originalPrice,
                discountedPrice,
                label,
                badge,
                badgeEmoji,
                banner,
                isActive
            },
            { new: true, runValidators: true }
        );

        if (!plan) {
            return res.status(404).json({ success: false, error: 'Plan not found' });
        }

        res.json({ success: true, plan });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin: Delete pricing plan
router.delete('/admin/plans/:id', async (req, res) => {
    try {

        const plan = await Pricing.findByIdAndDelete(req.params.id);
        if (!plan) {
            return res.status(404).json({ success: false, error: 'Plan not found' });
        }

        res.json({ success: true, message: 'Plan deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin: Initialize default pricing plans
router.post('/admin/plans/initialize', async (req, res) => {
    try {

        const defaultPlans = [
            {
                tier: 'gold',
                durationMonths: 1,
                originalPrice: 199,
                discountedPrice: 199,
                label: '1 Month',
                badge: '',
                badgeEmoji: ''
            },
            {
                tier: 'gold',
                durationMonths: 3,
                originalPrice: 597,
                discountedPrice: 499,
                label: '3 Months',
                badge: 'Best Seller',
                badgeEmoji: '⭐'
            },
            {
                tier: 'gold',
                durationMonths: 6,
                originalPrice: 1194,
                discountedPrice: 899,
                label: '6 Months',
                badge: '',
                badgeEmoji: ''
            },
            {
                tier: 'gold',
                durationMonths: 12,
                originalPrice: 2388,
                discountedPrice: 1499,
                label: '12 Months',
                badge: 'Best Value',
                badgeEmoji: '🔥'
            }
        ];

        const createdPlans = [];
        for (const planData of defaultPlans) {
            const existingPlan = await Pricing.findOne({ tier: planData.tier, durationMonths: planData.durationMonths });
            if (!existingPlan) {
                const plan = new Pricing(planData);
                await plan.save();
                createdPlans.push(plan);
            }
        }

        res.json({
            success: true,
            message: 'Default plans initialized',
            created: createdPlans.length,
            plans: createdPlans
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
