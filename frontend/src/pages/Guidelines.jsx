import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';

const Guidelines = () => {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-orange-500/10 pt-[72px]">
            {/* Ambient Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-40">
                <div 
                    className="absolute top-[20%] right-[10%] w-[50%] h-[50%] rounded-full opacity-10 blur-[130px]"
                    style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 70%)' }}
                />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto px-6 py-20 lg:py-32">
                <header className="mb-20">
                    <Link to="/" className="inline-flex items-center gap-2 text-zinc-600 hover:text-orange-500 transition-colors mb-12 group">
                        <span className="text-lg group-hover:-translate-x-1 transition-transform">←</span>
                        <span className="text-sm font-medium">Back to Home</span>
                    </Link>
                    
                    <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5 mb-6">
                        <span className="text-orange-500 text-[10px] font-bold uppercase tracking-widest">Community Values</span>
                    </div>
                    
                    <h1 className="font-playfair text-5xl lg:text-7xl font-black mb-8 tracking-tight">
                        Community<br/>
                        <span className="text-orange-500">Guidelines.</span>
                    </h1>
                    <p className="text-zinc-500 text-lg max-w-2xl leading-relaxed">
                        DailyDate is built on mutual respect, kindness, and authenticity. 
                        We expect every member to uphold these values to keep our community safe and welcoming for everyone.
                    </p>
                </header>

                <div className="space-y-16">
                    {/* The Pillars */}
                    <div className="grid md:grid-cols-2 gap-6">
                        {[
                            { 
                                icon: '🤝', 
                                title: 'Respect', 
                                desc: 'Treat everyone with kindness. Harassment, hate speech, and bullying are strictly prohibited.' 
                            },
                            { 
                                icon: '👤', 
                                title: 'Authenticity', 
                                desc: 'Be yourself. Impersonation or fake profiles will lead to permanent account termination.' 
                            },
                            { 
                                icon: '🔒', 
                                title: 'Privacy', 
                                desc: 'Respect personal boundaries. Never share someone else\'s private information without consent.' 
                            },
                            { 
                                icon: '🚫', 
                                title: 'Consent', 
                                desc: 'Consent is mandatory. Always respect "no" and never pressure others.' 
                            }
                        ].map((item, i) => (
                            <div key={i} className="bg-zinc-50 border border-zinc-100 rounded-[40px] p-8 hover:border-orange-500/30 transition-colors">
                                <div className="text-4xl mb-6">{item.icon}</div>
                                <h3 className="text-xl font-bold mb-3 text-zinc-900">{item.title}</h3>
                                <p className="text-zinc-500 text-sm leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>

                    {/* Zero Tolerance */}
                    <section className="bg-zinc-50 border border-zinc-100 rounded-[40px] p-10 lg:p-14 relative overflow-hidden">
                        <div className="relative z-10">
                            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-zinc-900">
                                <span className="text-orange-500 text-3xl">⚠️</span> Zero Tolerance Policy
                            </h2>
                            <div className="grid md:grid-cols-2 gap-10">
                                <div className="space-y-4">
                                    <h4 className="font-bold text-zinc-900">Strictly Prohibited</h4>
                                    <ul className="space-y-3 text-sm text-zinc-500">
                                        <li>• Commercial use or advertising</li>
                                        <li>• Explicit or suggestive content</li>
                                        <li>• Spam and unsolicited messages</li>
                                        <li>• Underage use (18+ only)</li>
                                    </ul>
                                </div>
                                <div className="space-y-4">
                                    <h4 className="font-bold text-zinc-900">Immediate Consequences</h4>
                                    <p className="text-sm text-zinc-500 leading-relaxed">
                                        Violating these guidelines will result in an immediate warning or 
                                        permanent ban. We cooperate with law enforcement for illegal activities.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Reporting */}
                    <section className="text-center py-10 mb-20">
                        <h2 className="text-2xl font-bold mb-4">See something? Say something.</h2>
                        <p className="text-zinc-500 mb-8 max-w-lg mx-auto">
                            Reporting helps us keep the community healthy. All reports are anonymous and handled discreetly by our human moderators.
                        </p>
                        <button className="bg-orange-500 text-white px-10 py-4 rounded-full font-bold hover:shadow-xl hover:shadow-orange-500/20 transition-all hover:scale-105">
                            Report a Violation
                        </button>
                    </section>
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default Guidelines;

