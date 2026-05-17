import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';


const AboutUs = () => {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-orange-500/10 overflow-hidden pt-[72px]">
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-40">
                <div 
                    className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full opacity-10 blur-[100px]"
                    style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 70%)' }}
                />
            </div>

            <div className="relative z-10 max-w-5xl mx-auto px-6 pt-10 pb-20 lg:pt-16 lg:pb-32">
                <header className="mb-24">
                    <Link to="/" className="inline-flex items-center gap-2 text-zinc-600 hover:text-orange-500 transition-colors mb-16 group">
                        <span className="text-xl group-hover:-translate-x-1 transition-transform">←</span>
                        <span className="text-sm font-medium">Back to Home</span>
                    </Link>
                    
                    <h1 className="font-playfair text-6xl lg:text-8xl font-black mb-8 tracking-tighter leading-none">
                        Our Story. <br/>
                        <span className="text-orange-500 italic">Daily Date.</span>
                    </h1>
                    <p className="text-zinc-500 text-xl max-w-2xl leading-relaxed">
                        DailyDate is more than just a dating platform; it is a movement aimed at bringing back genuine human connection 
                        in an era of mindless swiping.
                    </p>
                </header>

                <div className="grid md:grid-cols-2 gap-12 mb-32">
                    <div className="bg-zinc-50 border border-zinc-100 rounded-[48px] p-10 lg:p-14 backdrop-blur-2xl">
                        <h2 className="text-3xl font-bold mb-6 italic tracking-tight">The Problem</h2>
                        <p className="text-zinc-500 leading-relaxed">
                            Traditional dating apps have become games. They prioritize quantity over quality, 
                            and superficiality over substance. This leads to burnout and a lack of meaningful outcomes.
                        </p>
                    </div>
                    <div className="bg-orange-50 border border-orange-500/20 rounded-[48px] p-10 lg:p-14 backdrop-blur-2xl">
                        <h2 className="text-3xl font-bold mb-6 italic tracking-tight text-orange-600">The Solution</h2>
                        <p className="text-zinc-800 leading-relaxed font-medium">
                            DailyDate focuses on verified authenticity and intentional matching. 
                            By limiting matches and requiring real verification, we ensure every connection 
                            has the potential to be a real story.
                        </p>
                    </div>
                </div>

                <section className="space-y-20 mb-32">
                    <div className="text-center max-w-3xl mx-auto">
                        <h2 className="font-playfair text-4xl lg:text-5xl font-bold mb-6">Why DailyDate?</h2>
                        <div className="w-20 h-1 bg-orange-500 mx-auto rounded-full" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { title: 'Verified Only', desc: 'Every user on DailyDate is verified with a real mobile number via OTP. Verified profiles only.' },
                            { title: 'Intentional Matching', desc: 'We don\'t believe in infinite swiping. We give you matches that actually matter.' },
                            { title: 'Privacy by Design', desc: 'Your data is yours. We never sell your information or run intrusive ads.' }
                        ].map((item, i) => (
                            <div key={i} className="group p-8 rounded-3xl border border-zinc-100 hover:border-orange-500/30 transition-all text-center bg-white">
                                <h3 className="text-xl font-bold mb-4 group-hover:text-orange-500 transition-colors uppercase tracking-widest text-sm text-zinc-900">{item.title}</h3>
                                <p className="text-zinc-500 text-sm leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                        {/* Legal Policies Card */}
                        <div className="group p-8 rounded-3xl border border-zinc-100 hover:border-orange-500/30 transition-all text-center bg-zinc-50/50">
                            <h3 className="text-xl font-bold mb-4 group-hover:text-orange-500 transition-colors uppercase tracking-widest text-sm text-zinc-900">Legal Documents</h3>
                            <div className="flex flex-col gap-2">
                                <Link to="/privacy-policy" className="text-zinc-500 text-sm hover:text-orange-500 transition-colors font-medium">Privacy Policy</Link>
                                <Link to="/terms-conditions" className="text-zinc-500 text-sm hover:text-orange-500 transition-colors font-medium">Terms & Conditions</Link>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mb-32 space-y-12">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <h2 className="text-4xl font-black mb-6 tracking-tight">The Visionary <span className="text-orange-500">Behind</span> DailyDate</h2>
                            <div className="w-12 h-1 bg-orange-500 mb-8" />
                            <p className="text-zinc-500 leading-relaxed mb-6">
                                Founded by <strong>Our Team</strong>, DailyDate was born out of a simple yet profound observation: 
                                the digital age has made us more connected than ever, yet more lonely than ever.
                            </p>
                            <p className="text-zinc-500 leading-relaxed mb-6">
                                Our team envisioned a platform that stripped away the superficial "game-like" elements of dating 
                                and replaced them with **Verified Authenticity**. Started in 2024, the mission was to create 
                                a space where every match is a real person, every message is intentional, and every 
                                connection is built on a foundation of trust.
                            </p>
                            <div className="p-6 bg-zinc-50 border-l-4 border-orange-500 rounded-r-3xl">
                                <p className="italic text-zinc-700 font-medium italic">
                                    "We aren't just building an app; we are restoring faith in the digital first impression."
                                </p>
                                <p className="mt-2 font-black text-xs uppercase tracking-widest text-orange-600">— DailyDate Team</p>
                            </div>
                        </div>
                        <div className="relative">
                            <div className="aspect-square bg-orange-500/5 rounded-[64px] flex items-center justify-center border-2 border-zinc-100 overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <i className="fas fa-quote-left text-9xl text-orange-500/10 absolute top-10 left-10" />
                                <div className="text-center p-12">
                                    <h3 className="text-5xl font-playfair font-black text-zinc-900 mb-4 tracking-tighter">100%</h3>
                                    <p className="text-sm font-bold uppercase tracking-widest text-orange-500">Verified Philosophy</p>
                                    <p className="mt-4 text-xs text-zinc-400 max-w-[200px] mx-auto leading-relaxed">
                                        Every feature we build is designed to protect real human interaction.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mb-32">
                    <div className="bg-zinc-950 text-white rounded-[64px] p-12 lg:p-20 relative overflow-hidden">
                        <div className="relative z-10 grid lg:grid-cols-2 gap-12">
                            <div>
                                <h2 className="text-3xl font-black mb-6">Operated by <span className="text-orange-500">DailyDate.</span></h2>
                                <p className="text-zinc-400 leading-relaxed mb-8">
                                    This website is operated by DailyDate. We work with full transparency from our office 
                                    in North India, ensuring we are always accountable to our community.
                                </p>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-orange-500">
                                            <i className="fas fa-id-card text-sm"></i>
                                        </div>
                                        <span className="text-sm font-medium">DailyDate</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-orange-500">
                                            <i className="fas fa-map-marker-alt text-sm"></i>
                                        </div>
                                        <span className="text-sm font-medium">Mau, Uttar Pradesh</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-end justify-end">
                                <p className="text-6xl lg:text-9xl font-black opacity-10 tracking-tighter uppercase">SINCE 2026</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="bg-orange-500 rounded-[64px] p-12 lg:p-20 text-zinc-950 text-center relative overflow-hidden mb-32">
                    <div className="relative z-10">
                        <h2 className="font-playfair text-4xl lg:text-6xl font-black mb-8 tracking-tight">
                            Ready to find your <br className="hidden lg:block"/> person?
                        </h2>
                        <div className="flex flex-wrap justify-center gap-4">
                            <Link to="/register" className="bg-zinc-950 text-white px-10 py-5 rounded-full font-bold hover:scale-105 transition-transform text-lg shadow-2xl">
                                Join Daily Date Today
                            </Link>
                        </div>
                    </div>
                    {/* Visual Flashes */}
                    <div className="absolute top-[-50%] left-[-50%] w-full h-full bg-white opacity-10 blur-[100px] rounded-full pointer-events-none" />
                </section>
            </div>
            <Footer />
        </div>
    );
};

export default AboutUs;

