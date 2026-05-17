import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from './context/ToastContext';
import { UIProvider } from './context/UIContext';
import './index.css';
import App from './App.jsx';

// Verified Google Client ID from mobile app SplashScreen.tsx
const GOOGLE_CLIENT_ID = "985893937388-rqjjmrqib0egobl1n4e61fptffjiqm6q.apps.googleusercontent.com";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <UIProvider>
        <App />
      </UIProvider>
    </ToastProvider>
  </StrictMode>,
);
