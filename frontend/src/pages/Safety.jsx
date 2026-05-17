import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';

const Safety = () => {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-orange-500/10 pt-[72px]">
            {/* Background Decorations */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-40">
                <div 
                    className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full opacity-10 blur-[120px]"
                    style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 70%)' }}
                />
                <div 
                    className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full opacity-5 blur-[120px]"
                    style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 70%)' }}
                />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto px-6 py-20 lg:py-32">
                {/* Header */}
                <header className="mb-16">
                    <Link 
                        to="/" 
                        className="inline-flex items-center gap-2 text-zinc-500 hover:text-orange-500 transition-colors mb-12 group"
                    >
                        <span className="text-lg group-hover:-translate-x-1 transition-transform">←</span>
                        <span className="text-sm font-medium">Back to Home</span>
                    </Link>
                    
                    <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5 mb-6">
                        <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                        <span className="text-orange-500 text-[10px] font-bold uppercase tracking-widest">Trust & Safety</span>
                    </div>
                    
                    <h1 className="font-playfair text-5xl lg:text-7xl font-black mb-6 tracking-tight">
                        Your Safety is our <br/>
                        <span className="text-orange-500 italic">Priority.</span>
                    </h1>
                    <p className="text-zinc-500 text-lg max-w-2xl leading-relaxed">
                        At DailyDate, we're committed to building a community where you feel secure, respected, and empowered. 
                        Follow these guidelines to ensure a safe and positive experience.
                    </p>
                </header>

                {/* Content Sections */}
                <div className="space-y-12">
                    <section className="bg-zinc-50 border border-zinc-100 rounded-[32px] p-8 lg:p-12 backdrop-blur-xl">
                        <h2 className="text-2xl font-bold mb-6 text-zinc-900 flex items-center gap-3">
                            <span className="text-orange-500 text-3xl">🛡️</span> Account Security
                        </h2>
                        <div className="space-y-6 text-zinc-500 leading-relaxed">
                            <p>
                                <strong className="text-zinc-900 block mb-1">Never Share OTPs</strong>
                                We will never ask for your login OTP or password over a call, email, or message. 
                                Keep these credentials strictly private.
                            </p>
                            <p>
                                <strong className="text-zinc-900 block mb-1">Verify Your Profile</strong>
                                Use our mobile verification to ensure you're interacting with real people. 
                                Look for the verified badges when matching.
                            </p>
                            <p>
                                <strong className="text-zinc-900 block mb-1">Secure Your Device</strong>
                                Enable screen locks and never leave your logged-in device unattended in public places.
                            </p>
                        </div>
                    </section>

                    <section className="grid md:grid-cols-2 gap-8">
                        <div className="bg-zinc-50 border border-zinc-100 rounded-[32px] p-8 backdrop-blur-xl">
                            <h3 className="text-xl font-bold mb-4 text-zinc-900 flex items-center gap-3">
                                <span className="text-orange-500 text-2xl">☕</span> Meeting Safely
                            </h3>
                            <ul className="space-y-4 text-sm text-zinc-500">
                                <li className="flex gap-3">
                                    <span className="text-orange-500">•</span>
                                    Always meet in public, well-lit spaces for the first few dates.
                                </li>
                                <li className="flex gap-3">
                                    <span className="text-orange-500">•</span>
                                    Inform a friend or family member about your plans and location.
                                </li>
                                <li className="flex gap-3">
                                    <span className="text-orange-500">•</span>
                                    Arrange your own transportation to and from the venue.
                                </li>
                            </ul>
                        </div>
                        <div className="bg-zinc-50 border border-zinc-100 rounded-[32px] p-8 backdrop-blur-xl">
                            <h3 className="text-xl font-bold mb-4 text-zinc-900 flex items-center gap-3">
                                <span className="text-orange-500 text-2xl">🚩</span> Red Flags
                            </h3>
                            <ul className="space-y-4 text-sm text-zinc-500">
                                <li className="flex gap-3">
                                    <span className="text-orange-500">•</span>
                                    Anyone asking for money or financial help immediately.
                                </li>
                                <li className="flex gap-3">
                                    <span className="text-orange-500">•</span>
                                    Users pressuring you to move to another platform too quickly.
                                </li>
                                <li className="flex gap-3">
                                    <span className="text-orange-500">•</span>
                                    Inconsistent stories or refusal to meet in public.
                                </li>
                            </ul>
                        </div>
                    </section>

                    <section className="bg-orange-500 rounded-[32px] p-8 lg:p-12 text-zinc-950 relative overflow-hidden mb-20">
                        <div className="relative z-10">
                            <h2 className="text-3xl font-black mb-4 tracking-tight">Report & Block</h2>
                            <p className="font-medium text-zinc-900/80 mb-8 max-w-xl">
                                If you encounter anyone violating our terms or making you feel uncomfortable, 
                                use the "Report" button on their profile immediately. Our moderation team 
                                reviews every report within 24 hours.
                            </p>
                            <button className="bg-zinc-950 text-white px-8 py-3 rounded-full font-bold hover:scale-105 transition-transform">
                                Reach Support
                            </button>
                        </div>
                        <span className="absolute -bottom-10 -right-10 text-[12rem] font-black opacity-10 leading-none">!</span>
                    </section>
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default Safety;

