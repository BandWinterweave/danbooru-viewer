import React from 'react';
import ReactDOM from 'react-dom/client';
import { SettingsPanel } from '../components/settings/SettingsPanel';
import '../styles.css';
import { ErrorBoundary } from '../components/feedback/ErrorBoundary';
import { ToastViewport } from '../components/feedback/ToastViewport';
import { I18nProvider } from '../i18n/runtime';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><I18nProvider page="settings"><ErrorBoundary><SettingsPanel /><ToastViewport /></ErrorBoundary></I18nProvider></React.StrictMode>);
