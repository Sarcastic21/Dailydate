import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useUI } from '../context/UIContext';
import Logo from './Logo';

const Navbar = () => {
    const { theme } = useUI();
    const navigate = useNavigate();
    const location = useLocation();

    const handlePricingClick = (e) => {
        e.preventDefault();
        if (location.pathname === '/') {
            // Already on landing page — smooth scroll
            const el = document.getElementById('pricing');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        } else {
            // Navigate to landing page and scroll after load
            navigate('/#pricing');
            setTimeout(() => {
                const el = document.getElementById('pricing');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
            }, 300);
        }
    };

    return (
        <nav
            className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b transition-all duration-300"
            style={{
                backgroundColor: theme === 'dark' ? 'rgba(5, 5, 5, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
            }}
        >
            <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
                {/* Brand */}
                <Link to="/" className="flex items-center gap-3 group">
                    <Logo size="small" className={theme === 'dark' ? 'white-bg' : ''} />
                    <span className="text-2xl font-black tracking-tighter bg-gradient-to-r from-orange-600 to-orange-400 bg-clip-text text-transparent group-hover:scale-105 transition-transform">
                        DailyDate
                    </span>
                </Link>

                {/* Navigation Links - Desktop Only */}
                <div className="hidden lg:flex items-center gap-8">
                    <Link
                        to="/"
                        className="text-sm font-bold opacity-60 hover:opacity-100 hover:text-orange-500 transition-all uppercase tracking-widest"
                    >
                        Home
                    </Link>

                    {/* Pricing — scrolls to pricing section on landing page */}
                    <a
                        href="/#pricing"
                        onClick={handlePricingClick}
                        className="text-sm font-bold opacity-60 hover:opacity-100 hover:text-orange-500 transition-all uppercase tracking-widest cursor-pointer"
                    >
                        Pricing
                    </a>

                    <Link
                        to="/about"
                        className="text-sm font-bold opacity-60 hover:opacity-100 hover:text-orange-500 transition-all uppercase tracking-widest"
                    >
                        About
                    </Link>
                    <Link
                        to="/contact-us"
                        className="text-sm font-bold opacity-60 hover:opacity-100 hover:text-orange-500 transition-all uppercase tracking-widest"
                    >
                        Contact Us
                    </Link>
                    <Link
                        to="/safety"
                        className="text-sm font-bold opacity-60 hover:opacity-100 hover:text-orange-500 transition-all uppercase tracking-widest"
                    >
                        Safety
                    </Link>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4">
                    {/* Auth removed for public site */}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
