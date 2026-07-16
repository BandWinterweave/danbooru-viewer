import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { messages } from '../../i18n/en';

interface State { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State { return { error }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Danbooru Viewer render failure', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <main className="fatal-state">
      <div className="fatal-state-mark"><AlertTriangle size={24} /></div>
      <span className="state-kicker">{messages.feedback.recovery}</span>
      <h1>{messages.states.crashedTitle}</h1>
      <p>{messages.states.crashedBody}</p>
      <button className="state-action" onClick={() => window.location.reload()}><RotateCcw size={15} />{messages.actions.reload}</button>
    </main>;
  }
}
