import React from 'react';
import ReactDOM from 'react-dom/client';
import { ExternalLink, Search } from 'lucide-react';
import '../styles.css';

function Popup() {
  const openViewer = () => chrome.tabs.create({ url: 'chrome://newtab' });
  return (
    <main className="popup-shell">
      <div className="brand-mark brand-mark--small">D</div>
      <div><strong>Danbooru Viewer</strong><p>Search from your new tab.</p></div>
      <button className="primary-button popup-button" onClick={openViewer}><Search size={16} /> Open viewer <ExternalLink size={14} /></button>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Popup /></React.StrictMode>);
