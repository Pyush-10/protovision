import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App.jsx';
import './index.css';

// Retrieve Clerk publishable key from environment
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const isPlaceholder = !PUBLISHABLE_KEY || PUBLISHABLE_KEY.includes('placeholder') || !PUBLISHABLE_KEY.startsWith('pk_');

function ConfigFallback() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-obsidian)', color: 'var(--text-primary)', padding: '2rem' }}>
      <div className="scanlines"></div>
      <div className="cyber-panel" style={{ width: '100%', maxWidth: '500px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="panel-header" style={{ justifyContent: 'center' }}>
          <span className="panel-title text-error">⚠️ AUTH UPLINK OFFLINE</span>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
          Clerk Authentication environment variables are not yet configured. Please follow the instructions below to enable the generator uplink:
        </p>
        <div style={{ background: 'rgba(5, 5, 10, 0.8)', border: '1px solid var(--border-muted)', padding: '1rem', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--neon-cyan)' }}>[SYSTEM DIRECTIONS]</div>
          <ol style={{ fontSize: '0.8rem', paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
            <li>Log into your <a href="https://dashboard.clerk.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--neon-cyan)', textDecoration: 'underline' }}>Clerk Dashboard</a>.</li>
            <li>Copy your <strong>Publishable Key</strong>.</li>
            <li>Paste it into <code style={{ color: 'var(--neon-magenta)', fontFamily: 'var(--font-mono)' }}>client/.env</code>:
              <pre style={{ margin: '0.25rem 0 0 0', background: '#000', padding: '0.4rem', borderRadius: '3px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>VITE_CLERK_PUBLISHABLE_KEY=pk_test_...</pre>
            </li>
            <li>Paste it & the <strong>Secret Key</strong> into <code style={{ color: 'var(--neon-magenta)', fontFamily: 'var(--font-mono)' }}>server/.env</code>:
              <pre style={{ margin: '0.25rem 0 0 0', background: '#000', padding: '0.4rem', borderRadius: '3px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>CLERK_SECRET_KEY=sk_test_...</pre>
            </li>
            <li>Restart the development server using <code style={{ fontFamily: 'var(--font-mono)' }}>npm run dev</code>.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isPlaceholder ? (
      <ConfigFallback />
    ) : (
      <ClerkProvider 
        publishableKey={PUBLISHABLE_KEY}
        appearance={{
          variables: {
            colorPrimary: 'hsl(180, 100%, 50%)', // neon-cyan
            colorBackground: 'hsl(230, 20%, 9%)', // bg-panel
            colorText: 'hsl(220, 40%, 95%)', // text-primary
            colorTextSecondary: 'hsl(225, 15%, 65%)', // text-muted
            colorInputBackground: 'rgba(5, 5, 10, 0.8)',
            colorInputText: 'hsl(220, 40%, 95%)',
            colorTextOnPrimaryBackground: 'hsl(230, 25%, 5%)',
          }
        }}
      >
        <App />
      </ClerkProvider>
    )}
  </React.StrictMode>,
);
