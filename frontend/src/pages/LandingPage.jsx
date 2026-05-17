import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { HiBadgeCheck } from "react-icons/hi";
import BASE_URL from '../api';
import Footer from '../components/Footer';

/* ─────────────────────────────────────────────
   CUSTOM CURSOR
───────────────────────────────────────────── */


/* ─────────────────────────────────────────────
   SCROLL REVEAL HOOK
───────────────────────────────────────────── */
const useReveal = () => {
    useEffect(() => {
        const els = document.querySelectorAll('[data-reveal]');
        els.forEach((el) => {
            el.style.opacity = '0';
            el.style.transform =
                el.dataset.reveal === 'right'
                    ? 'translateX(40px)'
                    : el.dataset.reveal === 'left'
                        ? 'translateX(-40px)'
                        : 'translateY(36px)';
            el.style.transition =
                'opacity 0.9s cubic-bezier(0.23,1,0.32,1), transform 0.9s cubic-bezier(0.23,1,0.32,1)';
        });
        const obs = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) {
                        e.target.style.opacity = '1';
                        e.target.style.transform = 'none';
                        obs.unobserve(e.target);
                    }
                });
            },
            { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
        );
        setTimeout(() => els.forEach((el) => obs.observe(el)), 50); // Reduced from 120ms to 50ms for faster reveal
        return () => obs.disconnect();
    }, []);
};

/* ─────────────────────────────────────────────
   ANIMATED COUNTER
───────────────────────────────────────────── */
const Counter = ({ end, suffix, label }) => {
    const [count, setCount] = useState(0);
    const ref = useRef(null);
    useEffect(() => {
        const obs = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) return;
                let n = 0;
                const step = end / 80;
                const timer = setInterval(() => {
                    n = Math.min(n + step, end);
                    setCount(Math.floor(n));
                    if (n >= end) clearInterval(timer);
                }, 20);
                obs.unobserve(ref.current);
            },
            { threshold: 0.5 }
        );
        if (ref.current) obs.observe(ref.current);
        return () => obs.disconnect();
    }, [end]);

    return (
        <div ref={ref} className="text-center py-10 md:py-16">
            <div className="font-playfair text-5xl lg:text-6xl font-black text-white tracking-tight">
                {count >= 1000 ? count.toLocaleString('en-IN') : count}
                <span className="text-orange-500">{suffix}</span>
            </div>
            <div className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mt-3">
                {label}
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────
   APP SCREEN — DISCOVER
───────────────────────────────────────────── */
const DiscoverScreen = ({
    imgUrl = 'https://i.pinimg.com/474x/10/07/fe/1007fea40781d861e40088ccae3faf20.jpg',
    name = 'Ananya, 24',
    meta = '📍 Mumbai · 98% Match',
}) => {
    const [imgLoaded, setImgLoaded] = useState(false);
    return (
        <div className="h-full flex flex-col bg-black relative">
            {/* Header Overlay */}
            <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center p-3 bg-gradient-to-b from-black/60 to-transparent">
                <span className="text-[10px] font-black text-orange-500 tracking-widest uppercase">
                    Discover
                </span>
                <div className="flex items-center gap-1 bg-green-500/20 px-2 py-0.5 rounded-full border border-green-500/30">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[7px] font-black text-green-500">LIVE</span>
                </div>
            </div>

            {/* Main Image */}
            <div className="flex-1 relative overflow-hidden">
                {!imgLoaded && (
                    <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
                )}
                <img 
                    src={imgUrl} 
                    alt={name} 
                    loading="lazy"
                    onLoad={() => setImgLoaded(true)}
                    className={`w-full h-full object-cover ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-transparent" />

                {/* Info Overlay */}
                <div className="absolute bottom-6 left-4 right-16 z-20">
                    <h3 className="text-xl font-black text-white tracking-tight leading-none mb-1">{name}</h3>
                    <div className="inline-flex items-center gap-1.5 bg-orange-500/20 px-2 py-0.5 rounded-full border border-orange-500/30 mb-2">
                        <span className="text-[7px] font-black text-orange-400 uppercase tracking-widest">Marriage</span>
                    </div>
                    <p className="text-[9px] font-bold text-white/60 flex items-center gap-1">
                        <i className="fas fa-map-marker-alt"></i> {meta}
                    </p>
                </div>

                {/* Right Actions Column (Block Direction) */}
                <div className="absolute right-3 bottom-8 flex flex-col items-center gap-4 z-30">
                    {/* Nope */}
                    <div className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md border-[2.5px] border-red-500 flex items-center justify-center transition-all hover:scale-110">
                        <i className="fas fa-times text-red-500 text-xs"></i>
                    </div>
                    {/* Like */}
                    <div className="w-14 h-14 rounded-full bg-black/20 backdrop-blur-md border-[3.5px] border-orange-500 flex items-center justify-center transition-all hover:scale-110 shadow-lg shadow-orange-500/20">
                        <i className="fas fa-heart text-orange-500 text-base"></i>
                    </div>
                    {/* Chat */}
                    <div className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md border-[2.5px] border-blue-500 flex items-center justify-center transition-all hover:scale-110">
                        <i className="fas fa-comment-alt text-blue-500 text-[10px]"></i>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────
   APP SCREEN — CHAT
───────────────────────────────────────────── */
const ChatScreen = () => {
    const [imgLoaded, setImgLoaded] = useState(false);
    const messages = [
        { me: false, text: 'Hey! I loved your profile 😊' },
        { me: true, text: 'Just got back from Manali ✈️' },
        { me: false, text: 'No way! I was there last month!' },
        { me: true, text: 'Maybe this was meant to happen 😊' },
        { me: false, text: 'I think so too 💕' },
    ];
    return (
        <div className="h-full flex flex-col bg-black p-3">
            <div className="flex items-center gap-2 pb-4 border-b border-white/10">
                <div className="relative">
                    {!imgLoaded && (
                        <div className="w-9 h-9 rounded-full bg-zinc-800 animate-pulse" />
                    )}
                    <img
                        src="https://i.pinimg.com/736x/63/1f/94/631f94127dc704fd1d7109ddf6bf41d9.jpg"
                        loading="lazy"
                        onLoad={() => setImgLoaded(true)}
                        className={`w-9 h-9 rounded-full object-cover border-2 border-orange-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                        alt="avatar"
                    />
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-black rounded-full" />
                </div>
                <div>
                    <p className="text-[10px] font-black text-white">Priya Sharma</p>
                    <p className="text-[7px] font-bold text-orange-500 uppercase tracking-widest">Premium Member</p>
                </div>
            </div>
            <div className="flex-1 flex flex-col gap-2.5 py-4 overflow-hidden">
                {messages.map((m, i) => (
                    <div
                        key={i}
                        className={`px-3 py-2 rounded-2xl text-[9px] font-medium leading-relaxed max-w-[85%]
              ${m.me
                                ? 'bg-orange-500 text-white self-end rounded-br-none shadow-lg shadow-orange-500/20'
                                : 'bg-white/10 text-white/90 self-start rounded-bl-none border border-white/5'}`}
                    >
                        {m.text}
                    </div>
                ))}
            </div>
            <div className="flex items-center gap-2 bg-white/5 rounded-2xl px-3 py-2.5 border border-white/10">
                <span className="text-[8px] font-bold text-white/40 flex-1">Type something sweet...</span>
                <div className="w-5 h-5 bg-orange-500 rounded-lg flex items-center justify-center text-white text-[8px] shadow-lg shadow-orange-500/20">→</div>
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────
   APP SCREEN — MATCHES
───────────────────────────────────────────── */
const MatchesScreen = () => {
    const [imagesLoaded, setImagesLoaded] = useState({});
    const profiles = [
        { url: 'https://i.pinimg.com/736x/c2/62/eb/c262eb5e24c9ee7a9b47293129cebb7c.jpg', name: 'Priya', dist: '2 km' },
        { url: 'https://i.pinimg.com/736x/63/40/f8/6340f85048e57e51cac2f78150179ff4.jpg', name: 'Riya', dist: '5 km' },
        { url: 'https://i.pinimg.com/736x/19/87/81/19878141e261cb617fedcc760d6c80cc.jpg', name: 'Ishani', dist: '8 km' },
    ];
    const handleImageLoad = (index) => {
        setImagesLoaded(prev => ({ ...prev, [index]: true }));
    };
    return (
        <div className="h-full flex flex-col bg-black p-4 gap-5">
            <h2 className="text-xs font-black text-white uppercase tracking-widest pl-1">Your Matches</h2>

            <div className="grid grid-cols-2 gap-3">
                {profiles.map((p, i) => (
                    <div key={i} className="relative rounded-2xl overflow-hidden aspect-[4/5] border border-white/5">
                        {!imagesLoaded[i] && (
                            <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
                        )}
                        <img 
                            src={p.url} 
                            alt={p.name} 
                            loading="lazy"
                            onLoad={() => handleImageLoad(i)}
                            className={`w-full h-full object-cover ${imagesLoaded[i] ? 'opacity-100' : 'opacity-0'}`}
                        />
                        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                            <p className="text-[8px] font-black text-white">{p.name}</p>
                            <p className="text-[6px] font-bold text-orange-500">{p.dist} away</p>
                        </div>
                    </div>
                ))}
                {/* Liked You Card */}
                <div className="relative rounded-2xl overflow-hidden aspect-[4/5] bg-orange-500/10 border-2 border-dashed border-orange-500/30 flex flex-col items-center justify-center p-2">
                    <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-xs mb-1 shadow-lg shadow-orange-500/20">🔒</div>
                    <p className="text-[7px] font-black text-orange-500 uppercase">99+ Likes</p>
                    <p className="text-[6px] font-bold text-white/40">Tap to see</p>
                </div>
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────
   MARQUEE STRIP
───────────────────────────────────────────── */
const Marquee = () => {
    const items = [
        '15,000+ Members', '1,000+ Couples Formed', 'Intelligent Matching',
        '98% Verified Profiles', '4.0★ App Rating', "India's #1 Dating App", 'End-to-End Encrypted',
    ];
    return (
        <div className="bg-orange-500 py-4 overflow-hidden">
            <div
                className="flex gap-12 whitespace-nowrap"
                style={{ animation: 'marquee 28s linear infinite', width: 'max-content' }}
                onMouseEnter={(e) => (e.currentTarget.style.animationPlayState = 'paused')}
                onMouseLeave={(e) => (e.currentTarget.style.animationPlayState = 'running')}
            >
                {[...items, ...items].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/90">{item}</span>
                        <span className="w-1 h-1 bg-white/40 rounded-full" />
                    </div>
                ))}
            </div>
        </div>
    );
};



/* ─────────────────────────────────────────────
   STORY CARD
───────────────────────────────────────────── */
const StoryCard = ({ img, names, loc, matched, submitterName, partnerName, storyType, couplePhoto, createdAt }) => {
    const displayImg = couplePhoto?.url || img;
    const displayNames = submitterName ? `${submitterName} & ${partnerName}` : names;
    const displayType = storyType || loc;

    // Format date if it's a dynamic story
    let displayDate = matched;
    if (createdAt) {
        const date = new Date(createdAt);
        displayDate = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }

    const [imgLoaded, setImgLoaded] = useState(false);

    return (
        <Link to="/success-stories" className="block relative rounded-3xl overflow-hidden shrink-0 w-[280px] lg:w-[320px] h-[400px] lg:h-[460px] group cursor-pointer border border-white/5">
            {!imgLoaded && (
                <div className="absolute inset-0 bg-zinc-200 animate-pulse" />
            )}
            <img
                src={displayImg}
                alt={displayNames}
                loading="lazy"
                onLoad={() => setImgLoaded(true)}
                className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6">
                <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-orange-400 mb-1.5">
                    DailyDate Success
                </p>
                <h3 className="font-playfair text-xl font-bold text-white mb-0.5 tracking-tight">{displayNames}</h3>
                <p className="text-[11px] font-medium text-white/50">💝 {displayType} · {displayDate}</p>
            </div>
        </Link>
    );
};

/* ─────────────────────────────────────────────
   PRICING CARD
───────────────────────────────────────────── */
const PricingCard = ({ plan, popular, delay }) => {
    const monthlyPrice = Math.round(plan.discountedPrice / plan.durationMonths);
    const allFeatures = [
        { label: '50 Premium Likes / day', available: true },
        { label: 'See who liked you', available: true },
        { label: 'Real-time messaging', available: true },
        { label: 'Advanced match filters', available: true },
        { label: 'Verified Orange Tick Badge', icon: <HiBadgeCheck className="text-orange-500 text-lg" />, available: true },
    ];

    // Banner logic
    const hasBanner = plan.banner?.isActive;
    const bannerStyle = hasBanner ? {
        backgroundColor: plan.banner.backgroundColor,
        color: plan.banner.textColor
    } : {};

    return (
        <div
            data-reveal
            style={{ transitionDelay: delay }}
            className={`relative rounded-3xl p-8 flex flex-col transition-all duration-500
        hover:-translate-y-2 border
        ${popular
                    ? 'bg-zinc-950 border-zinc-900 scale-105 shadow-2xl hover:shadow-orange-500/10'
                    : 'bg-white border-zinc-100 shadow-md hover:shadow-xl hover:border-orange-200'}`}
        >
            {/* Banner Alert */}
            {hasBanner && (
                <div 
                    className="absolute -top-px left-0 right-0 py-2 text-[9px] font-black uppercase tracking-widest text-center rounded-t-3xl overflow-hidden z-10"
                    style={bannerStyle}
                >
                    {plan.banner.text}
                </div>
            )}

            {/* Badge Pill */}
            {plan.badge && (
                <div className={`absolute ${hasBanner ? 'top-10' : '-top-px'} left-1/2 -translate-x-1/2 bg-orange-500 text-white
                        text-[10px] font-bold tracking-widest uppercase px-5 py-1.5 rounded-b-xl z-20`}>
                    {plan.badgeEmoji || '⭐'} {plan.badge}
                </div>
            )}

            <p className={`text-[10px] font-bold tracking-[0.2em] uppercase mb-4 ${hasBanner ? 'mt-8' : ''} ${popular ? 'text-zinc-500' : 'text-zinc-400'}`}>
                {plan.label || `${plan.durationMonths} Month${plan.durationMonths > 1 ? 's' : ''}`}
            </p>

            <div className="flex items-baseline gap-1 mb-1">
                <span className={`font-playfair text-5xl font-black ${popular ? 'text-white' : 'text-zinc-900'}`}>
                    <sup className="text-2xl align-super">₹</sup>{plan.discountedPrice}
                </span>
            </div>

            <div className="flex items-center gap-2 mb-1">
                {plan.originalPrice > plan.discountedPrice && (
                    <span className={`text-sm line-through ${popular ? 'text-zinc-600' : 'text-zinc-300'}`}>
                        ₹{plan.originalPrice}
                    </span>
                )}
                {plan.discountPercentage > 0 && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg
            ${popular ? 'bg-orange-500/30 text-orange-300' : 'bg-orange-50 text-orange-500'}`}>
                        SAVE {plan.discountPercentage}%
                    </span>
                )}
            </div>

            <p className={`text-xs mb-6 ${popular ? 'text-zinc-500' : 'text-zinc-400'}`}>
                ₹{monthlyPrice} / month
            </p>

            <div className={`h-px mb-6 ${popular ? 'bg-white/10' : 'bg-zinc-100'}`} />

            <ul className="space-y-3 flex-1 mb-8">
                {allFeatures.map((f, i) => (
                    <li key={i} className={`flex items-center gap-3 ${!f.available ? 'opacity-25' : ''}`}>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0
              ${f.available
                                ? popular ? 'bg-orange-500/30 text-orange-300' : 'bg-orange-50 text-orange-500'
                                : popular ? 'bg-white/10 text-white/30' : 'bg-zinc-100 text-zinc-300'}`}>
                            {f.available ? '✓' : '—'}
                        </div>
                        <div className="flex items-center gap-2">
                            {f.icon && f.icon}
                            <span className={`text-sm ${popular ? 'text-zinc-400' : 'text-zinc-600'}`}>{f.label}</span>
                        </div>
                    </li>
                ))}
            </ul>

            <Link
                to="/register"
                className={`block text-center py-4 rounded-2xl font-semibold text-sm tracking-wide
          transition-all duration-300 hover:scale-[1.02]
          ${popular
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/40 hover:bg-orange-400'
                        : 'border-2 border-zinc-200 text-zinc-800 hover:border-orange-400 hover:text-orange-500 hover:bg-orange-50'}`}
            >
                Get Started →
            </Link>
        </div>
    );
};

/* ─────────────────────────────────────────────
   REVIEW CARD
───────────────────────────────────────────── */


/* ─────────────────────────────────────────────
   SECTION LABEL HELPER
───────────────────────────────────────────── */
const SectionLabel = ({ children, center = false, light = false }) => (
    <p className={`flex items-center gap-3 text-[11px] font-bold tracking-[0.2em] uppercase mb-4
    ${light ? 'text-orange-400' : 'text-orange-500'}
    ${center ? 'justify-center' : ''}`}>
        <span className={`w-8 h-px ${light ? 'bg-orange-400' : 'bg-orange-500'}`} />
        {children}
        {center && <span className={`w-8 h-px ${light ? 'bg-orange-400' : 'bg-orange-500'}`} />}
    </p>
);

/* ─────────────────────────────────────────────
   MAIN LANDING PAGE
───────────────────────────────────────────── */
const LandingPage = () => {
    const [plans, setPlans] = useState([]);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [navScrolled, setNavScrolled] = useState(false);
    const floatRef = useRef(null);
    const tRef = useRef(0);

    useReveal();

    /* Nav scroll */
    useEffect(() => {
        const fn = () => setNavScrolled(window.scrollY > 60);
        window.addEventListener('scroll', fn);
        return () => window.removeEventListener('scroll', fn);
    }, []);

    /* Hero phones float animation */
    useEffect(() => {
        const phones = document.querySelectorAll('.dd-float');
        const animate = () => {
            tRef.current += 0.012;
            phones.forEach((p, i) => {
                const y = Math.sin(tRef.current + i * 1.2) * 8;
                const rot = i === 0 ? -8 : i === 2 ? 8 : 0;
                const sc = i === 1 ? 1 : 0.84;
                p.style.transform = `rotate(${rot}deg) scale(${sc}) translateY(${y}px)`;
            });
            floatRef.current = requestAnimationFrame(animate);
        };
        floatRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(floatRef.current);
    }, []);

    useEffect(() => {
        setLoadingPlans(true);
        // Lazy load pricing plans after initial render
        const timeoutId = setTimeout(() => {
            axios.get(`${BASE_URL}/pricing/plans`)
                .then(res => {
                    if (res.data.success) {
                        setPlans(res.data.plans);
                    }
                })
                .catch(err => console.error("Error fetching plans:", err))
                .finally(() => setLoadingPlans(false));
        }, 500); // Delay by 500ms to allow initial render

        return () => clearTimeout(timeoutId);
    }, []);

    const [fetchedStories, setFetchedStories] = useState([]);
    const [loadingStories, setLoadingStories] = useState(false);
    const storiesRef = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && fetchedStories.length === 0 && !loadingStories) {
                    setLoadingStories(true);
                    axios.get(`${BASE_URL}/stories/approved`)
                        .then(res => {
                            if (res.data.success && res.data.stories.length > 0) {
                                setFetchedStories(res.data.stories);
                            }
                        })
                        .catch(err => console.error("Error fetching stories:", err))
                        .finally(() => setLoadingStories(false));
                }
            },
            { threshold: 0.1 }
        );

        if (storiesRef.current) {
            observer.observe(storiesRef.current);
        }

        return () => observer.disconnect();
    }, [fetchedStories, loadingStories]);

    /* ── DATA ── */
    const staticStories = [];

    const finalStories = fetchedStories.length > 0 ? fetchedStories : staticStories;





    const appFeatures = [
        { icon: <i className="fas fa-sparkles"></i>, title: 'Daily curated matches', desc: "Wake up to fresh high-quality matches every morning, based on your city, state, and interests." },
        { icon: <i className="fas fa-eye"></i>, title: 'See who liked you', desc: "Know exactly who’s interested before you match. No guessing games — just genuine mutual interest." },
        { icon: <i className="fas fa-location-dot"></i>, title: 'State & city matching', desc: "Find people in your city or anywhere across your state. Filter by location to meet people near you." },
        { icon: <i className="fas fa-shield-halved"></i>, title: 'Mobile & Email Verified', desc: "Every profile is verified via secure Mobile & Email OTP. Verified profiles only—just real people." },
    ];

    /* ── RENDER ── */
    return (
        <>
            {/* Inject keyframes + Google Font */}
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

        body { font-family: 'DM Sans', sans-serif; overflow-x: hidden; }

        .font-playfair { font-family: 'Playfair Display', serif; }
        .font-mono-dm  { font-family: 'DM Mono', monospace; }

        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes dd-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.3); }
        }
        @keyframes dd-bounce {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-8px); }
        }

        .dd-pulse  { animation: dd-pulse  2s infinite; }
        .dd-bounce { animation: dd-bounce 2s ease-in-out infinite; }

        /* Scroll-reveal base state set by JS */
      `}</style>



            {/* ══════════════════════════ HERO ══════════════════════════ */}
            <section className="relative min-h-screen flex items-center overflow-hidden bg-zinc-950">
                {/* BG */}
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&q=90&w=1920')] bg-cover bg-center opacity-20 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/80 to-transparent" />
                <div
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-[600px] h-[600px]
                     rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(255,77,0,0.15) 0%, transparent 70%)' }}
                />

                {/* Content grid */}
                <div className="relative z-10 max-w-[1400px] mx-auto px-8 lg:px-16 w-full
                        grid grid-cols-1 lg:grid-cols-2 gap-16 items-center py-32">

                    {/* ── Left copy ── */}
                    <div>
                        <div className="inline-flex items-center gap-3 bg-white/5 border border-white/10
                            rounded-full px-5 py-2.5 mb-8">
                            <span className="dd-pulse w-1.5 h-1.5 bg-orange-500 rounded-full shadow-[0_0_12px_rgba(249,115,22,0.5)]" />
                            <span className="text-zinc-400 text-xs font-semibold tracking-[0.1em] uppercase">
                                India's Most Trusted Dating App
                            </span>
                        </div>

                        <h1 className="font-playfair font-black text-white tracking-tight leading-[0.93] mb-8"
                            style={{ fontSize: 'clamp(3.5rem,6vw,6rem)' }}>
                            Find the one<br />
                            who makes<br />
                            <em className="text-orange-500 not-italic">everything click.</em>
                        </h1>

                        <p className="text-zinc-400 text-lg leading-relaxed mb-10 max-w-lg font-light">
                            Join <strong className="text-white font-semibold">15,000+</strong> verified
                            singles across India. Intelligent matches. Real conversations. Love stories that last.
                        </p>

                        <div className="flex flex-wrap gap-4 mb-10">
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-3 bg-orange-500 hover:bg-orange-400
                           text-white font-semibold px-8 py-4 rounded-full transition-all
                           hover:-translate-y-1 hover:shadow-2xl hover:shadow-orange-500/40 text-sm"
                            >
                                Login Now
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </Link>
                            <a
                                href="#stories"
                                className="inline-flex items-center gap-3 bg-white/5 hover:bg-white/10 text-white
                           font-medium px-8 py-4 rounded-full border border-white/15
                           hover:border-white/30 transition-all text-sm"
                            >
                                See Love Stories →
                            </a>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {['🔒 SSL Secured', '✅ Mobile Verified', '⭐ 4.0 Rated', '🇮🇳 Made in India'].map((c) => (
                                <span key={c} className="text-[10px] font-semibold tracking-wide border
                                         border-white/10 text-zinc-500 px-4 py-1.5 rounded-full">
                                    {c}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* ── Right: three phones ── */}
                    <div className="hidden lg:flex items-center justify-center relative h-[580px]">
                        {/* Left phone */}
                        <div
                            className="dd-float absolute left-[2%] top-1/2 -translate-y-1/2
                         w-[200px] h-[400px] bg-zinc-900 rounded-[36px]
                         border-[6px] border-zinc-800 shadow-2xl overflow-hidden opacity-70 z-0"
                        >
                            <MatchesScreen />
                        </div>

                        {/* Centre phone */}
                        <div
                            className="dd-float absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                         w-[230px] h-[460px] bg-zinc-900 rounded-[40px]
                         border-[7px] border-zinc-800 shadow-2xl overflow-hidden z-10"
                        >
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-5 bg-zinc-900 rounded-b-2xl z-20" />
                            <DiscoverScreen />
                        </div>

                        {/* Right phone */}
                        <div
                            className="dd-float absolute right-[2%] top-1/2 -translate-y-1/2
                         w-[200px] h-[400px] bg-zinc-900 rounded-[36px]
                         border-[6px] border-zinc-800 shadow-2xl overflow-hidden opacity-70 z-0"
                        >
                            <ChatScreen />
                        </div>
                    </div>
                </div>

                {/* Scroll indicator */}
                <div className="dd-bounce absolute bottom-10 left-1/2 -translate-x-1/2 z-10">
                    <div className="w-6 h-10 border-2 border-white/20 rounded-full flex justify-center pt-2">
                        <div className="w-1 h-2 bg-orange-500/60 rounded-full" />
                    </div>
                </div>
            </section >

            {/* ══════════════════════════ MARQUEE ══════════════════════════ */}
            < Marquee />

            <div className="bg-zinc-950 border-y border-white/5">
                <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-3">
                    <div className="border-b md:border-b-0 md:border-r border-white/5">
                        <Counter end={1000} suffix="+" label="Couples Formed" />
                    </div>
                    <div className="border-b md:border-b-0 md:border-r border-white/5">
                        <Counter end={98} suffix="%" label="Verified Profiles" />
                    </div>
                    <div className="text-center py-10 md:py-16">
                        <div className="font-playfair text-5xl lg:text-6xl font-black text-white tracking-tight">
                            4.0<span className="text-orange-500">★</span>
                        </div>
                        <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-500 mt-4 opacity-70">
                            App Store Rating
                        </div>
                    </div>
                </div>
            </div>


            {/* ══════════════════════════ DOWNLOAD APP ══════════════════════════ */}
            <section id="download-app" className="py-24 px-8 lg:px-16 bg-gradient-to-br from-orange-500 to-orange-600 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://i.pinimg.com/736x/49/bb/49/49bb4962c8d3cdabdf6f055c531a9e24.jpg')] bg-cover bg-center opacity-30 mix-blend-overlay pointer-events-none" />
                <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
                    <div data-reveal="left">
                        <h2 className="font-playfair text-5xl lg:text-7xl font-black text-white leading-tight mb-8">
                            Experience the best of <br />
                            DailyDate on <em className="text-white opacity-80 not-italic">your phone.</em>
                        </h2>
                        <p className="text-white/80 text-lg lg:text-xl mb-12 max-w-xl font-light">
                            Unlock the full power of genuine connections. Verified profiles,
                            instant notifications, and seamless chatting — all in the palm of your hand.
                        </p>
                        <div className="flex flex-wrap gap-4">
                            <a href="#" className="flex items-center gap-4 bg-white text-zinc-900 px-8 py-4 rounded-3xl transition-all hover:scale-105 shadow-xl hover:shadow-white/20">
                                <i className="fab fa-google-play text-3xl text-orange-500"></i>
                                <div className="text-left">
                                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">Get it on</p>
                                    <p className="text-lg font-black tracking-tight">Google Play</p>
                                </div>
                            </a>
                            <div className="flex items-center gap-4 bg-zinc-900/40 text-white/50 px-8 py-4 rounded-3xl border border-white/5 cursor-not-allowed">
                                <i className="fab fa-apple text-3xl opacity-30"></i>
                                <div className="text-left">
                                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">Coming soon</p>
                                    <p className="text-lg font-black tracking-tight">App Store</p>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </section>
            {/* ══════════════════════════ HOW IT WORKS ══════════════════════════ */}
            <section id="how-it-works" className="py-28 px-8 lg:px-16 bg-white">
                <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">

                    {/* Steps */}
                    <div>
                        <div data-reveal>
                            <SectionLabel>Simple Process</SectionLabel>
                            <h2 className="font-playfair font-black text-zinc-900 tracking-tight leading-tight mb-12"
                                style={{ fontSize: 'clamp(2.5rem,4vw,4rem)' }}>
                                From sign-up to<br /><em className="text-orange-500">first date,</em> in 4 steps.
                            </h2>
                        </div>

                        <div data-reveal className="relative">
                            <div className="absolute left-6 top-16 bottom-16 w-px bg-gradient-to-b from-orange-300 to-transparent opacity-30" />
                            {[
                                { n: '01', title: 'Create your profile', desc: "Sign up in under 60 seconds. Add photos, write your story, and tell us what matters to you in a partner." },
                                { n: '02', title: 'Get verified in minutes', desc: "Verify with a quick OTP on your mobile number or email. Fast, secure, and unlocks full access to all matches." },
                                { n: '03', title: 'Browse matches by location', desc: "Fresh match recommendations in your city and state land every day — tailored to your interests." },
                                { n: '04', title: 'Meet, connect, fall in love', desc: "Chat, plan a coffee, write your own love story. Over 1,000+ People daily online" },
                            ].map((step) => (
                                <div key={step.n} className="flex gap-6 py-7 group">
                                    <div
                                        className="font-mono-dm w-12 h-12 rounded-full border border-zinc-200 shrink-0
                               flex items-center justify-center text-xs text-zinc-400 bg-white
                               relative z-10 group-hover:bg-orange-500 group-hover:text-white
                               group-hover:border-orange-500 transition-all duration-300"
                                    >
                                        {step.n}
                                    </div>
                                    <div>
                                        <h3 className="font-playfair text-lg font-bold text-zinc-900 mb-1">{step.title}</h3>
                                        <p className="text-zinc-500 text-sm leading-relaxed">{step.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Phone visual */}
                    <div data-reveal className="hidden lg:flex items-center justify-center relative h-[600px]">
                        <div className="w-[260px] h-[520px] bg-zinc-900 rounded-[44px] border-[8px]
                            border-zinc-800 shadow-2xl overflow-hidden relative z-10">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-6 bg-zinc-900 rounded-b-2xl z-20" />
                            <DiscoverScreen
                                imgUrl="https://i.pinimg.com/736x/ee/a6/08/eea60851ef845f3b28aba6131472b24a.jpg"
                                name="Maya, 25"
                                meta="📍 Mumbai · Data Scientist · 98% Match"
                            />
                        </div>
                        {/* Floating badge — new match */}
                        <div className="absolute bottom-[18%] -left-6 bg-white rounded-2xl shadow-xl
                            border border-zinc-100 px-4 py-3 flex items-center gap-3 z-20">
                            <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center text-lg shrink-0">💕</div>
                            <div>
                                <p className="text-xs font-semibold text-zinc-900">New Match!</p>
                                <p className="text-[10px] text-zinc-400">Ananya liked your profile</p>
                            </div>
                        </div>
                        {/* Floating badge — verified */}
                        <div className="absolute top-[22%] -right-6 bg-white rounded-2xl shadow-xl
                            border border-zinc-100 px-4 py-3 flex items-center gap-3 z-20">
                            <div className="w-9 h-9 bg-green-500 rounded-xl flex items-center justify-center text-lg shrink-0">✅</div>
                            <div>
                                <p className="text-xs font-semibold text-zinc-900">Verified Profile</p>
                                <p className="text-[10px] text-zinc-400">ID + Face confirmed</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════ STORIES CAROUSEL ══════════════════════════ */}
            <section id="stories" ref={storiesRef} className="py-28 bg-zinc-50 overflow-hidden relative">
                {/* Dot grid */}
                <div
                    className="absolute inset-0 opacity-[0.05] pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #ccc 1px, transparent 0)', backgroundSize: '32px 32px' }}
                />

                {/* Header */}
                <div className="max-w-[1400px] mx-auto px-8 lg:px-16 mb-12">
                    <div data-reveal className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                        <div>
                            <SectionLabel>Real Couples, Real Love</SectionLabel>
                            <h2 className="font-playfair font-black text-zinc-900 tracking-tight leading-tight"
                                style={{ fontSize: 'clamp(2.5rem,4vw,4rem)' }}>
                                People who found<br />their <em className="text-orange-500">forever</em> here.
                            </h2>
                        </div>
                        <div className="flex flex-col gap-4">
                            <p className="font-playfair text-zinc-500 italic text-lg lg:text-right">1,000+ couples and counting</p>
                            <Link to="/success-stories" className="inline-flex items-center gap-2 bg-orange-500 text-white font-bold text-sm lg:justify-end px-8 py-3 rounded-full hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 active:scale-95">
                                View all stories <span>→</span>
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Loading State */}
                {loadingStories && (
                    <div className="flex justify-center py-12">
                        <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
                    </div>
                )}

                {/* Carousel */}
                {!loadingStories && finalStories.length > 0 && (
                    <div className="overflow-hidden">
                        <div className="flex gap-5 py-2 px-8 overflow-x-auto hide-scrollbar snap-x">
                            {finalStories.map((s, i) => (
                                <div key={i} className="shrink-0 snap-center">
                                    <StoryCard {...s} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {!loadingStories && finalStories.length === 0 && (
                     <div className="text-center py-12 text-zinc-500">
                         More stories coming soon!
                     </div>
                )}

                <div data-reveal className="max-w-[1400px] mx-auto px-8 lg:px-16 mt-12 text-center">
                    <Link
                        to="/register"
                        className="inline-flex items-center gap-3 bg-orange-500 hover:bg-orange-400 text-white
                       font-semibold px-8 py-4 rounded-full transition-all
                       hover:-translate-y-1 hover:shadow-2xl hover:shadow-orange-500/40 text-sm"
                    >
                        Find Your Match Today ✨
                    </Link>
                </div>
            </section>

            {/* ══════════════════════════ APP SECTION ══════════════════════════ */}
            <section id="app" className="py-28 px-8 lg:px-16 bg-zinc-950 overflow-hidden relative">
                <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">

                    {/* Phones */}
                    <div data-reveal className="hidden lg:flex items-center justify-center relative h-[650px]">
                        {/* Back phone */}
                        <div
                            className="absolute w-[230px] h-[460px] bg-zinc-900 rounded-[40px]
                         border-[7px] border-zinc-800 shadow-xl overflow-hidden opacity-35"
                            style={{ left: '8%', top: '50%', transform: 'rotateY(-5deg) scale(0.88) translateY(-50%)' }}
                        >
                            <MatchesScreen />
                        </div>
                        {/* Front phone */}
                        <div
                            className="absolute w-[255px] h-[510px] bg-zinc-900 rounded-[44px]
                         border-[8px] border-zinc-800 shadow-2xl overflow-hidden z-10"
                            style={{ left: '50%', top: '50%', transform: 'rotateY(-10deg) translateX(-35%) translateY(-50%)' }}
                        >
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-6 bg-zinc-900 rounded-b-2xl z-20" />
                            <ChatScreen />
                        </div>
                    </div>

                    {/* Copy */}
                    <div>
                        <div data-reveal>
                            <SectionLabel light>The App Experience</SectionLabel>
                            <h2 className="font-playfair font-black text-white tracking-tight leading-tight mb-12"
                                style={{ fontSize: 'clamp(2.5rem,4vw,4rem)' }}>
                                Beautifully designed.<br /><em className="text-orange-500">Obsessively refined.</em>
                            </h2>
                        </div>

                        <div data-reveal className="space-y-2">
                            {appFeatures.map((f, i) => (
                                <div
                                    key={i}
                                    className="flex gap-4 items-start p-4 rounded-2xl hover:bg-white/5 transition-colors group cursor-default"
                                >
                                    <div className="w-11 h-11 bg-white/5 rounded-xl
                                  flex items-center justify-center text-lg text-orange-500 shrink-0
                                  group-hover:scale-110 group-hover:bg-orange-500 group-hover:text-white transition-all duration-300">
                                        {f.icon}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-white mb-1">{f.title}</p>
                                        <p className="text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div data-reveal className="flex gap-4 mt-10 flex-wrap">
                            <a href="#" className="flex items-center gap-3 bg-white text-zinc-950 px-6 py-3.5 rounded-2xl transition-all hover:scale-105 shadow-xl hover:shadow-white/10">
                                <i className="fab fa-google-play text-2xl text-orange-500"></i>
                                <div className="text-left">
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase">Get it on</p>
                                    <p className="font-bold text-base leading-tight">Google Play</p>
                                </div>
                            </a>
                            <div className="flex items-center gap-3 bg-zinc-900 text-zinc-500 px-6 py-3.5 rounded-2xl border border-white/5 cursor-not-allowed">
                                <i className="fab fa-apple text-2xl opacity-40"></i>
                                <div className="text-left">
                                    <p className="text-[10px] text-zinc-600 font-bold uppercase">Coming soon</p>
                                    <p className="font-bold text-zinc-500 text-base leading-tight">App Store</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>



            {/* ══════════════════════════ PRICING ══════════════════════════ */}
            <section id="pricing" className="py-28 px-8 lg:px-16 bg-white">
                <div className="max-w-[1400px] mx-auto">
                    <div data-reveal className="text-center mb-16">
                        <SectionLabel center>Pricing Plans</SectionLabel>
                        <h2 className="font-playfair font-black text-zinc-900 tracking-tight leading-tight mb-6"
                            style={{ fontSize: 'clamp(2.5rem,4vw,4rem)' }}>
                            Choose the plan that's<br /><em className="text-orange-500">right for you.</em>
                        </h2>
                        <p className="text-zinc-500 text-lg max-w-2xl mx-auto font-light">
                            Invest in your future. Join thousands of happy couples who found love on DailyDate.
                        </p>
                    </div>

                    {loadingPlans ? (
                        <div className="flex justify-center py-20">
                            <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
                            {plans.map((plan, i) => (
                                <PricingCard
                                    key={plan.id}
                                    plan={plan}
                                    popular={plan.badge === 'Popular' || plan.badge === 'Best Seller'}
                                    delay={`${i * 0.1}s`}
                                />
                            ))}
                        </div>
                    )}

                    <div data-reveal className="mt-16 text-center">
                        <p className="text-zinc-400 text-sm mb-4 italic">
                            All plans include full access to premium features.
                        </p>
                        <div className="flex justify-center gap-8 grayscale opacity-30">
                            <i className="fab fa-cc-visa text-3xl"></i>
                            <i className="fab fa-cc-mastercard text-3xl"></i>
                            <i className="fas fa-university text-3xl"></i>
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════ FINAL CTA ══════════════════════════ */}
            <section className="py-32 px-8 lg:px-16 bg-zinc-950 relative overflow-hidden text-center">
                <div className="absolute inset-0 bg-[url('https://i.pinimg.com/736x/d7/44/77/d744771f1e750dd16bc07f3f0809d0a2.jpg')] bg-cover bg-center opacity-10" />
                <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle,rgba(255,77,0,0.12) 0%,transparent 70%)', filter: 'blur(60px)' }}
                />

                <div data-reveal className="relative z-10 max-w-2xl mx-auto">
                    <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20
                          rounded-full px-5 py-2 mb-8">
                        <span className="text-orange-500 text-[10px] font-bold tracking-[0.2em] uppercase">
                            Your love story starts today
                        </span>
                    </div>

                    <h2 className="font-playfair font-black text-white tracking-tight leading-tight mb-6"
                        style={{ fontSize: 'clamp(3rem,6vw,5.5rem)' }}>
                        Your person is<br />out there, <em className="text-orange-500">waiting.</em>
                    </h2>

                    <p className="text-zinc-400 text-base mb-10 max-w-md mx-auto leading-relaxed">
                        15,000+ verified singles. Intelligent matching. Love stories written every day.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            to="/register"
                            className="inline-flex items-center justify-center gap-3 bg-orange-500 hover:bg-orange-400
                         text-white font-semibold px-10 py-5 rounded-full transition-all
                         hover:-translate-y-1 hover:shadow-2xl hover:shadow-orange-500/30 text-base"
                        >
                            Create Free Account ✨
                        </Link>
                        <Link
                            to="/login"
                            className="inline-flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10
                         text-white font-medium px-10 py-5 rounded-full border border-white/15
                         hover:border-white/30 transition-all text-base"
                        >
                            Already a member? →
                        </Link>
                    </div>

                    <p className="text-zinc-500 text-xs mt-6 tracking-wide">
                        Secure Payment - join now
                    </p>
                </div>
            </section>

            <Footer />
        </>
    );
};

export default LandingPage;
