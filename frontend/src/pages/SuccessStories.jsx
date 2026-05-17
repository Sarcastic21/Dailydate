import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import BASE_URL from '../api';
import Footer from '../components/Footer';

const SuccessStories = () => {
    const [stories, setStories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const cardsPerPage = 40;

    useEffect(() => {
        window.scrollTo(0, 0);
        fetchStories();
    }, []);

    const fetchStories = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/stories/approved`);
            if (res.data.success) {
                setStories(res.data.stories);
            }
        } catch (err) {
            console.error("Failed to fetch stories:", err);
        } finally {
            setLoading(false);
        }
    };

    const staticStories = [];
    const allStories = stories.length > 0 ? stories : staticStories;

    // Pagination logic
    const totalPages = Math.ceil(allStories.length / cardsPerPage);
    const indexOfLastCard = currentPage * cardsPerPage;
    const indexOfFirstCard = indexOfLastCard - cardsPerPage;
    const currentStories = allStories.slice(indexOfFirstCard, indexOfLastCard);

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handlePrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <div className="bg-white min-h-screen pt-[72px]">
            {/* Hero Section */}
            <header className="pt-10 pb-16 px-6 bg-zinc-50/50 border-b border-zinc-100">
                <div className="max-w-[1200px] mx-auto text-center">
                    <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-600 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-6">
                        💝 DailyDate success stories
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black text-zinc-900 tracking-tight leading-tight mb-6 font-playfair">
                        Where love finds its <br />
                        <span className="text-orange-500 italic">perfect match</span>
                    </h1>
                    <p className="text-zinc-500 text-lg max-w-2xl mx-auto mb-10">
                        Incredible journeys of couples who found each other on DailyDate. 
                        Your forever story could be next.
                    </p>
                    <a 
                        href="/#download-app"
                        className="inline-flex items-center gap-3 bg-zinc-900 text-white px-8 py-4 rounded-full text-sm font-bold hover:bg-orange-500 transition-all shadow-xl shadow-zinc-900/20 group active:scale-95"
                    >
                        <i className="fab fa-google-play text-xl text-orange-500 group-hover:text-white transition-colors"></i>
                        <div className="text-left flex flex-col">
                            <span className="text-[10px] uppercase tracking-widest opacity-70 leading-none mb-1">Get the app</span>
                            <span className="leading-none">Download to submit your story</span>
                        </div>
                    </a>
                </div>
            </header>

            {/* Stories Grid */}
            <main className="py-20 px-8 lg:px-16">
                <div className="max-w-[1200px] mx-auto">
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <>
                            {currentStories.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
                                        {currentStories.map((story, i) => (
                                            <StoryCard key={story._id || i} story={story} />
                                        ))}
                                    </div>

                                    {/* Pagination Controls */}
                                    {totalPages > 1 && (
                                        <div className="flex justify-center items-center gap-6 pt-10 border-t border-zinc-200">
                                            <button 
                                                onClick={handlePrevPage}
                                                disabled={currentPage === 1}
                                                className={`px-8 py-3 rounded-full text-sm font-bold transition-all ${
                                                    currentPage === 1 
                                                    ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed' 
                                                    : 'bg-white text-zinc-900 border border-zinc-200 hover:border-orange-500 hover:text-orange-500 shadow-sm'
                                                }`}
                                            >
                                                ← Previous
                                            </button>
                                            <span className="text-sm font-bold text-zinc-500 uppercase tracking-widest">
                                                Page {currentPage} <span className="opacity-40 px-1">/</span> {totalPages}
                                            </span>
                                            <button 
                                                onClick={handleNextPage}
                                                disabled={currentPage === totalPages}
                                                className={`px-8 py-3 rounded-full text-sm font-bold transition-all ${
                                                    currentPage === totalPages 
                                                    ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed' 
                                                    : 'bg-white text-zinc-900 border border-zinc-200 hover:border-orange-500 hover:text-orange-500 shadow-sm'
                                                }`}
                                            >
                                                Next →
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-20 bg-white rounded-[40px] border border-zinc-100 shadow-sm px-8">
                                    <div className="text-6xl mb-6">✨</div>
                                    <h2 className="text-3xl font-bold text-zinc-900 font-playfair mb-4">Starting the Journey</h2>
                                    <p className="text-zinc-500 max-w-md mx-auto mb-10 text-lg">
                                        We are just getting started! Our first batch of success stories is coming very soon as more couples find their forever match.
                                    </p>
                                    <Link to="/register" className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-10 py-5 rounded-full transition-all shadow-xl shadow-orange-500/20 text-lg inline-block">
                                        Find Your Match Today
                                    </Link>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
};

const StoryCard = ({ story }) => {
    const displayImg = story.couplePhoto?.url || story.img;
    const displayNames = story.submitterName ? `${story.submitterName} & ${story.partnerName}` : story.names;
    const displayLoc = story.storyType || story.loc;
    
    let displayDate = story.matched;
    if (story.createdAt) {
        displayDate = new Date(story.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }

    return (
        <div 
            className="group relative rounded-[40px] overflow-hidden bg-black aspect-[3/4] shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2"
        >
            {/* Main Image */}
            <img 
                src={displayImg} 
                alt={displayNames}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-90 group-hover:opacity-100"
            />

            {/* Premium Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

            {/* Verified Badge */}
            <div className="absolute top-6 right-6">
                <div className="bg-white/20 backdrop-blur-md border border-white/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">Verified Story</span>
                    <span className="text-orange-500 text-xs">●</span>
                </div>
            </div>

            {/* Content Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-8">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                        <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em]">Match Confirmed</span>
                    </div>
                    
                    <h2 className="text-white text-3xl font-black font-playfair tracking-tight">
                        {displayNames}
                    </h2>

                    <div className="flex items-center gap-3 mt-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-1.5 text-white/90 text-xs font-semibold">
                            <span>📍</span> {displayLoc}
                        </div>
                        <div className="w-1 h-1 bg-white/40 rounded-full" />
                        <div className="text-white/60 text-xs font-medium italic">
                            Matched {displayDate}
                        </div>
                    </div>

                    <div className="mt-6 flex items-center justify-end">
                        <div className="flex -space-x-3">
                           <div className="w-8 h-8 rounded-full border-2 border-black bg-zinc-800 flex items-center justify-center text-[10px]">💕</div>
                           <div className="w-8 h-8 rounded-full border-2 border-black bg-zinc-800 flex items-center justify-center text-[10px]">✨</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SuccessStories;

