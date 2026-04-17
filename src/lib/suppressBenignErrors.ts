/**
 * Suppress Benign Environment-Specific Errors
 * 
 * This module intercepts and silences known benign errors that occur in the 
 * sandboxed development environment (e.g., Vite WebSocket connection failures).
 * This improves the developer experience and ensures the console remains clean 
 * for actionable errors.
 */

export const initErrorSuppression = () => {
  if (typeof window === 'undefined') return;

  const suppressedPatterns = [
    '[vite] failed to connect to websocket',
    'WebSocket closed without opened',
    'the client is offline',
    'AbortError'
  ];

  const shouldSuppress = (msg: unknown): boolean => {
    if (!msg) return false;
    const str = String(msg);
    return suppressedPatterns.some(pattern => str.includes(pattern));
  };

  /**
   * Global Rejection Suppression
   * Catches unhandled promise rejections that match suppressed patterns.
   */
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    if (shouldSuppress(event.reason) || shouldSuppress(event.reason?.message)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  /**
   * Global Error Suppression
   * Catches synchronous errors that match suppressed patterns.
   */
  window.addEventListener('error', (event: ErrorEvent) => {
    if (shouldSuppress(event.message) || shouldSuppress(event.error)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  /**
   * Console Patching
   * Prevents specific log messages from cluttering the console.
   */
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (args.some(shouldSuppress)) return;
    originalError.apply(console, args);
  };

  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (args.some(shouldSuppress)) return;
    originalWarn.apply(console, args);
  };
};
