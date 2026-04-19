import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary Component
 * 
 * Catches JavaScript errors anywhere in their child component tree,
 * logs those errors, and displays a fallback UI instead of the component tree that crashed.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    (this as any).state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  public render(): ReactNode {
    const state = (this as any).state;
    if (state.hasError) {
      return (
        <div className="min-h-screen bg-bg flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-surface border border-accent-red/30 rounded-2xl p-8 shadow-2xl text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent-red/10 text-accent-red mb-2">
              <AlertTriangle size={32} />
            </div>
            <h1 className="text-2xl font-bold text-text-main">System Interruption</h1>
            <p className="text-text-sub text-sm leading-relaxed">
              An unexpected error occurred in the EventFlow AI engine. Our automated systems have been notified.
            </p>
            <div className="p-4 bg-bg rounded-lg border border-border text-left">
              <p className="text-[10px] font-mono text-accent-red break-all">
                {state.error?.message || 'Unknown system error'}
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-2 bg-brand text-white py-3 rounded-xl font-bold hover:bg-brand/90 transition-all shadow-lg shadow-brand/20"
            >
              <RefreshCw size={18} />
              Restart Application
            </button>
            <p className="text-[10px] text-text-sub italic">
              EventFlow AI v2.1.0 • Enterprise Resilience Layer
            </p>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
