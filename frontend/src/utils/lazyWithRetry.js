import { lazy } from 'react';

/**
 * Enhanced React.lazy with automatic retry for dynamic imports.
 * Recovers seamlessly from transient network hiccups, Vite HMR updates, or new deployment chunk hashes.
 *
 * @param {() => Promise<{ default: React.ComponentType<any> }>} importFn
 * @param {number} retries Number of retry attempts before fallback
 * @param {number} delayMs Backoff delay in milliseconds
 * @returns {React.LazyExoticComponent<React.ComponentType<any>>}
 */
export function lazyWithRetry(importFn, retries = 2, delayMs = 350) {
  return lazy(async () => {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await importFn();
      } catch (err) {
        lastError = err;
        const msg = err?.message || String(err || '');
        const isDynamicImportErr =
          msg.includes('Failed to fetch dynamically imported module') ||
          msg.includes('error loading dynamically imported module') ||
          msg.includes('Importing a module script failed') ||
          err?.name === 'ChunkLoadError';

        if (!isDynamicImportErr || attempt === retries) {
          break;
        }

        // Wait with backoff before next attempt
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }

    // If retries failed on a dynamic import error, perform a single auto-reload
    const msg = lastError?.message || String(lastError || '');
    if (
      typeof window !== 'undefined' &&
      (msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('error loading dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        lastError?.name === 'ChunkLoadError')
    ) {
      const storageKey = 'cf_lazy_auto_reload';
      const lastReload = sessionStorage.getItem(storageKey);
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
        sessionStorage.setItem(storageKey, String(now));
        window.location.reload();
        // Return a pending promise to prevent ErrorBoundary flashing during reload
        return new Promise(() => {});
      }
    }

    throw lastError;
  });
}

export default lazyWithRetry;
