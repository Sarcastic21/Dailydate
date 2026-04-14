const mongoose = require('mongoose');

const pricingSchema = new mongoose.Schema({
    tier: {
        type: String,
        enum: ['gold'],
        default: 'gold',
        required: true
    },
    durationMonths: {
        type: Number,
        required: true,
        enum: [1, 3, 6, 12]
    },
    originalPrice: {
        type: Number,
        required: true,
        min: 0
    },
    discountedPrice: {
        type: Number,
        required: true,
        min: 0
    },
    discountPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    label: {
        type: String,
        required: true
    },
    badge: {
        type: String,
        enum: ['Best Seller', 'Best Value', 'Popular', ''],
        default: ''
    },
    badgeEmoji: {
        type: String,
        default: ''
    },
    banner: {
        text: {
            type: String,
            default: ''
        },
        backgroundColor: {
            type: String,
            default: '#FF4757'
        },
        textColor: {
            type: String,
            default: '#FFFFFF'
        },
        isActive: {
            type: Boolean,
            default: false
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    amountPaise: {
        type: Number,
        default: function() {
            return this.discountedPrice * 100;
        }
    }
}, {
    timestamps: true
});

// Compound index to ensure unique tier + duration combination
pricingSchema.index({ tier: 1, durationMonths: 1 }, { unique: true });

// Virtual for monthly price calculation
pricingSchema.virtual('monthlyPrice').get(function() {
    return Math.round(this.discountedPrice / this.durationMonths);
});

// Ensure virtuals are included in JSON
pricingSchema.set('toJSON', { virtuals: true });
pricingSchema.set('toObject', { virtuals: true });

// Pre-save hook to calculate discount percentage if not provided
pricingSchema.pre('save', function() {
    if (this.originalPrice > 0 && this.discountedPrice < this.originalPrice) {
        this.discountPercentage = Math.round(
            ((this.originalPrice - this.discountedPrice) / this.originalPrice) * 100
        );
    } else {
        this.discountPercentage = 0;
    }
    this.amountPaise = this.discountedPrice * 100;
});

module.exports = mongoose.model('Pricing', pricingSchema);
