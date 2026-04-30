import React from 'react';
import ReactDOM from 'react-dom/client';
import './tailwind-compiled.css';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import App from './App';
import { captureFromUrl as captureInviteFromUrl } from './lib/pendingInvite';

captureInviteFromUrl();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AuthProvider>
  </React.StrictMode>
);
