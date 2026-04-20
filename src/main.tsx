import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import { initMetrika } from '@/lib/metrika';
import 'leaflet/dist/leaflet.css';
import '@/styles/global.css';

function readCookie(name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
  if (!match) return null;
  return decodeURIComponent(match[1]);
}

const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const requestInit: RequestInit = { ...(init ?? {}) };
  const urlText = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const isApiRequest =
    urlText.startsWith('/api/') ||
    urlText.includes('/api/');

  if (isApiRequest) {
    requestInit.credentials = requestInit.credentials ?? 'include';
    const method = (requestInit.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const unsafeMethod = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
    if (unsafeMethod) {
      const csrfToken = readCookie('csrf_token');
      if (csrfToken) {
        const headers = new Headers(requestInit.headers ?? (input instanceof Request ? input.headers : undefined));
        headers.set('X-CSRF-Token', csrfToken);
        requestInit.headers = headers;
      }
    }
  }

  return originalFetch(input, requestInit);
};

class RootErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('RootErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            background: '#f9fafb',
            color: '#0f172a',
            padding: 24,
            fontFamily: 'Manrope, sans-serif',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          <h1 className="font-display text-xl font-bold m-0">Что-то пошло не так</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
            Обновите страницу. Если проблема сохранится — откройте консоль (F12) и сообщите об ошибке.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);

initMetrika();
