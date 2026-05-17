import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
    const footerLinks = [
        {
            title: 'Company',
            links: [
                { name: 'Home', path: '/' },
                { name: 'About Us', path: '/about' },
                { name: 'Success Stories', path: '/success-stories' },
                { name: 'Safety Tips', path: '/safety' },
                { name: 'Guidelines', path: '/guidelines' }
            ]
        },
        {
            title: 'Support',
            links: [
                { name: 'Contact Us', path: '/contact-us' }
            ]
        },
        {
            title: 'Legal',
            links: [
                { name: 'Privacy Policy', path: '/privacy-policy' },
                { name: 'Terms of Service', path: '/terms-conditions' }
            ]
        }
    ];

    const socialLinks = [
        { name: 'Instagram', icon: <i className="fab fa-instagram"></i>, url: 'https://www.instagram.com/dailydate.app?igsh=MmdxM2lsNm5vMTZj', target: '_blank' },
        { name: 'Gmail', icon: <i className="fas fa-envelope"></i>, url: 'mailto:dailydateapp@gmail.com' }
    ];

    return (
        <footer className="relative bg-zinc-950 pt-24 pb-12 overflow-hidden border-t border-white/[0.02]">
            {/* Ambient Background Element */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-orange-500/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 max-w-[1400px] mx-auto px-8 lg:px-16">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-16 mb-20">
                    {/* Brand column */}
                    <div className="lg:col-span-2">
                        <Link to="/" className="inline-block mb-8 group">
                            <span className="font-playfair text-3xl font-black text-white tracking-tight">
                                Daily<span className="text-orange-500 italic">Date.</span>
                            </span>
                        </Link>
                        <p className="text-zinc-300 text-sm leading-relaxed max-w-sm mb-10">
                            Engineered for real connections. Join millions finding genuine relationships 
                            through interest-based matching and verified authenticity.
                        </p>
                        <div className="flex gap-4">
                            {socialLinks.map((social) => (
                                <a 
                                    key={social.name} 
                                    href={social.url}
                                    target={social.target || '_self'}
                                    rel={social.target === '_blank' ? 'noopener noreferrer' : undefined}
                                    className="w-11 h-11 rounded-full border border-white/5 bg-white/[0.02] flex items-center justify-center text-zinc-400 hover:border-orange-500 hover:text-orange-500 hover:bg-orange-500/5 transition-all group/icon" 
                                    title={social.name}
                                >
                                    <div className="group-hover/icon:scale-110 transition-transform">
                                        {social.icon}
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Link columns */}
                    {footerLinks.map((col) => (
                        <div key={col.title}>
                            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-400 mb-6">
                                {col.title}
                            </p>
                            <ul className="space-y-4">
                                {col.links.map((link) => (
                                    <li key={link.name}>
                                        <Link to={link.path} className="text-sm text-zinc-300 hover:text-white transition-colors">
                                            {link.name}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Bottom Bar */}
                <div className="border-t border-white/[0.04] pt-10 flex flex-col md:flex-row justify-between items-center gap-6">
                    <p className="text-white text-[11px] font-bold tracking-wider">
                        © 2026 DailyDate
                    </p>
                    <div className="flex items-center gap-2 text-zinc-400 text-[10px] uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        Network Robust
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
