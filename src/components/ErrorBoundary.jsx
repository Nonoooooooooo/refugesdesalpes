import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <aside className="glass glass-panel absolute bottom-4 left-4 top-4 z-[1200] flex w-full sm:w-[400px] flex-col rounded-3xl p-6 text-white shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-3 text-amber-400">
            <AlertTriangle size={24} />
            <h2 className="text-base font-bold text-white">Une erreur est survenue</h2>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-white/75">
            Impossible d'afficher les détails de cet élément ({this.state.error?.message || 'Erreur inattendue'}).
          </p>
          <button
            onClick={this.handleReset}
            className="glass-btn mt-5 flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/20 active:scale-95"
          >
            <RefreshCw size={14} /> Fermer et continuer
          </button>
        </aside>
      );
    }

    return this.props.children;
  }
}
