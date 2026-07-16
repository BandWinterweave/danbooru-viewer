import type { LucideIcon } from 'lucide-react';
import { RotateCcw } from 'lucide-react';
import { messages } from '../../i18n/en';

export function StatePanel({ icon: Icon, title, body, tone = 'neutral', busy = false, onRetry }: { icon: LucideIcon; title: string; body: string; tone?: 'neutral' | 'error'; busy?: boolean; onRetry?: () => void }) {
  return <div className={`state-panel state-panel--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
    <div className={`state-panel-mark ${busy ? 'state-panel-mark--busy' : ''}`}><Icon size={22} /></div>
    <span className="state-kicker">{messages.feedback.index} / {tone === 'error' ? messages.feedback.interrupted : busy ? messages.feedback.syncing : messages.feedback.ready}</span>
    <strong>{title}</strong>
    <span>{body}</span>
    {onRetry && <button className="state-action" onClick={onRetry}><RotateCcw size={14} />{messages.actions.retry}</button>}
  </div>;
}
