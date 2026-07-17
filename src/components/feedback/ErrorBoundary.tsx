import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useI18n, type LocaleMessages } from '../../i18n/runtime';

interface State { error: Error | null }

class ErrorBoundaryInner extends Component<{ children: ReactNode; messages: LocaleMessages }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State { return { error }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Danbooru Viewer render failure', error, info.componentStack);
  }

  render() {
    const { messages } = this.props;
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

export function ErrorBoundary({ children }: { children: ReactNode }) {
  const { messages } = useI18n();
  return <ErrorBoundaryInner messages={messages}>{children}</ErrorBoundaryInner>;
}
