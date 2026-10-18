import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ERPProvider } from './context/ERPContext.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import App from './App.jsx';
import './index.css';

// Automatically handle Vite preload/chunk errors across the application
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    const storageKey = 'cf_vite_preload_reload';
    const lastAttempt = sessionStorage.getItem(storageKey);
    const now = Date.now();
    if (!lastAttempt || now - parseInt(lastAttempt, 10) > 15000) {
      sessionStorage.setItem(storageKey, String(now));
      window.location.reload();
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ERPProvider>
          <App />
        </ERPProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
