import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });

    // Handle dynamic import / chunk load failures automatically
    const msg = error?.message || (typeof error === 'string' ? error : '') || '';
    const isChunkOrDynamicImportError =
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('error loading dynamically imported module') ||
      error?.name === 'ChunkLoadError';

    if (isChunkOrDynamicImportError && typeof window !== 'undefined') {
      const storageKey = 'cf_boundary_reload';
      const lastAttempt = sessionStorage.getItem(storageKey);
      const now = Date.now();
      if (!lastAttempt || now - parseInt(lastAttempt, 10) > 15000) {
        sessionStorage.setItem(storageKey, String(now));
        window.location.reload();
      }
    }
  }

  handleReload = () => {
    try {
      sessionStorage.removeItem('cf_boundary_reload');
      sessionStorage.removeItem('cf_lazy_auto_reload');
    } catch {}
    window.location.reload();
  };

  handleReset = () => {
    try {
      localStorage.removeItem('campusflow_access_token');
      sessionStorage.clear();
    } catch {}
    window.location.href = '/login';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans">
          <div className="max-w-lg w-full bg-white rounded-3xl p-8 shadow-xl border border-slate-200 text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>

            <h2 className="text-xl font-black text-slate-900 mb-2">
              Something went wrong
            </h2>

            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              A runtime error occurred in this view. The application has safely intercepted the crash to prevent data corruption.
            </p>

            {this.state.error && (
              <div className="bg-slate-50 rounded-xl p-3 text-xs text-rose-700 font-mono text-left mb-6 overflow-x-auto border border-slate-200">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex gap-2.5 justify-center flex-wrap">
              <button
                onClick={this.handleReload}
                className="btn btn-primary text-xs font-bold px-4 py-2 flex items-center gap-2"
              >
                <RefreshCw size={14} />
                <span>Reload Page</span>
              </button>

              <button
                onClick={this.handleReset}
                className="btn btn-outline text-xs font-bold px-4 py-2 flex items-center gap-2"
              >
                <Home size={14} />
                <span>Return to Login</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
