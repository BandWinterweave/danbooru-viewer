import React from 'react';
import ReactDOM from 'react-dom/client';
import { SettingsPanel } from '../components/settings/SettingsPanel';
import '../styles.css';
import { ErrorBoundary } from '../components/feedback/ErrorBoundary';
import { ToastViewport } from '../components/feedback/ToastViewport';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><SettingsPanel /><ToastViewport /></ErrorBoundary></React.StrictMode>);
