import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';

// Main Screens (Lazy loaded for performance)
const PrivacyPolicy = lazy(() => import('./pages/LegalPrivacy'));
const TermsConditions = lazy(() => import('./pages/LegalTerms'));
const ContactUs = lazy(() => import('./pages/ContactUs'));
const Safety = lazy(() => import('./pages/Safety'));
const Guidelines = lazy(() => import('./pages/Guidelines'));
const AboutUs = lazy(() => import('./pages/AboutUs'));
const SuccessStories = lazy(() => import('./pages/SuccessStories'));
import LandingPage from './pages/LandingPage';

import './App.css';

// ── Loader Component ─────────────────────────────────────────────
const PageLoader = () => (
  <div className="flex justify-center items-center h-full min-h-[50vh]">
    <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
  </div>
);

// ── Main App Component ──────────────────────────────────────────
function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--app-bg)', color: 'var(--app-text)' }}>
        <Navbar />
        <main className="flex-1 w-full relative">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* ── Public Informational Pages (no Sidebar) ── */}
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-conditions" element={<TermsConditions />} />
              <Route path="/contact-us" element={<ContactUs />} />
              <Route path="/safety" element={<Safety />} />
              <Route path="/guidelines" element={<Guidelines />} />
              <Route path="/about" element={<AboutUs />} />
              <Route path="/success-stories" element={<SuccessStories />} />

              {/* ── Landing Page ── */}
              <Route path="/" element={<LandingPage />} />

              {/* Catch-all Redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </Router>
  );
}

export default App;
