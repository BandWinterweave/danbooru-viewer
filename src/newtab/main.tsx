import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '../styles.css';
import { ErrorBoundary } from '../components/feedback/ErrorBoundary';
import { I18nProvider } from '../i18n/runtime';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider page="viewer"><ErrorBoundary><App /></ErrorBoundary></I18nProvider>
  </React.StrictMode>,
);
