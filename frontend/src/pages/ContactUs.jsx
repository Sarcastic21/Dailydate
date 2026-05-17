import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';

const ContactUs = () => {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen flex flex-col font-sans selection:bg-orange-500/10 overflow-hidden bg-white text-zinc-900 pt-[72px]">
            {/* Background Accent */}
            <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-orange-500/5 blur-[120px] rounded-full pointer-events-none" />
            <div className="fixed bottom-0 left-0 w-[400px] h-[400px] bg-orange-600/5 blur-[100px] rounded-full pointer-events-none" />

            <div className="relative z-10 flex-1 max-w-5xl mx-auto px-6 pt-10 pb-20 lg:pt-16 lg:pb-32 w-full text-center">
                <header className="mb-16">
                    <Link to="/" className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-500 font-bold transition-all mb-8 group">
                        <span className="group-hover:-translate-x-1 transition-transform">←</span>
                        <span>Back to Home</span>
                    </Link>

                    <h1 className="text-5xl lg:text-7xl font-black mb-4 tracking-tight text-zinc-900">
                        Contact <span className="text-orange-500 italic">Us</span>
                    </h1>
                    <p className="text-lg max-w-lg mx-auto leading-relaxed opacity-60">
                        Have an issue, feedback, or a partnership idea? Reach out to us directly through any of the channels below.
                    </p>
                </header>

                <div className="grid lg:grid-cols-3 gap-8 items-start max-w-4xl mx-auto">
                    {/* Contact Info Cards */}
                    <div className="p-8 rounded-[32px] border border-zinc-100 bg-zinc-50 backdrop-blur-sm transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-orange-500/5">
                        <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center mb-6 shadow-lg shadow-orange-500/20 mx-auto">
                            <i className="fas fa-building text-white text-xl"></i>
                        </div>
                        <p className="text-xl font-bold mb-1">DailyDate</p>
                    </div>

                    <div className="p-8 rounded-[32px] border border-zinc-100 bg-zinc-50 backdrop-blur-sm transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-orange-500/5">
                        <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center mb-6 shadow-lg shadow-orange-500/20 mx-auto">
                            <i className="fas fa-map-marker-alt text-white text-xl"></i>
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-orange-500 mb-2">Registered Address</h3>
                        <p className="text-xl font-bold mb-2">Mau, Uttar Pradesh, India</p>
                    </div>

                    <div className="p-8 rounded-[32px] border border-zinc-100 bg-zinc-50 backdrop-blur-sm transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-orange-500/5">
                        <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center mb-6 shadow-lg shadow-orange-500/20 mx-auto">
                            <i className="fas fa-envelope text-white text-xl"></i>
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-orange-500 mb-2">Direct Email</h3>
                        <a href="mailto:dailydateapp@gmail.com" className="text-xl font-bold mb-2 block hover:text-orange-500 transition-colors">dailydateapp@gmail.com</a>
                        <p className="text-xs opacity-50">Expect a response within 24-48 hours.</p>
                    </div>
                </div>

                <div className="mt-20 p-12 rounded-[40px] border border-zinc-100 bg-orange-50/30">
                    <h2 className="text-3xl font-black mb-4">Need instant support?</h2>
                    <p className="text-zinc-600 mb-8 max-w-md mx-auto">You can reach us through direct email or download our official app to access the in-app help center and chat with our support team.</p>
                    <a
                        href="/#download-app"
                        className="inline-flex items-center gap-3 bg-orange-500 text-white font-black px-10 py-4 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-orange-500/20"
                    >
                        <span>Download App for Support</span>
                        <i className="fas fa-download text-xs"></i>
                    </a>
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default ContactUs;

