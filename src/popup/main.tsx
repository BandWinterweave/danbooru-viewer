import React from 'react';
import ReactDOM from 'react-dom/client';
import { ExternalLink, Search } from 'lucide-react';
import '../styles.css';
import { ErrorBoundary } from '../components/feedback/ErrorBoundary';
import { useTheme } from '../hooks/useTheme';
import { shellMessages } from '../i18n/en-shell';

function Popup() {
  useTheme();
  const openViewer = () => chrome.tabs.create({ url: chrome.runtime.getURL('src/newtab/index.html') });
  return (
    <main className="popup-shell">
      <div className="brand-mark brand-mark--small">D</div>
      <div><strong>{shellMessages.popup.brandName}</strong><p>{shellMessages.popup.description}</p></div>
      <button className="primary-button popup-button" onClick={openViewer}><Search size={16} /> {shellMessages.popup.openViewer} <ExternalLink size={14} /></button>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><Popup /></ErrorBoundary></React.StrictMode>);
