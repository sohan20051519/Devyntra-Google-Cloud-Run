
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Minimal functional error catcher: collect uncaught errors and show them instead of a white page.

function ClientErrorWrapper({ children }: React.PropsWithChildren<{}>) {
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onError = (event: ErrorEvent) => {
      setError(event.error?.toString?.() ?? event.message ?? String(event));
      console.error('Captured window error:', event.error ?? event.message, event.error?.stack);
    };
    const onRejection = (ev: PromiseRejectionEvent) => {
      setError(ev.reason?.toString?.() ?? JSON.stringify(ev.reason));
      console.error('Captured unhandled rejection:', ev.reason);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection as any);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection as any);
    };
  }, []);

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ color: '#B3261E' }}>An error occurred while rendering the app</h1>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{error}</pre>
      </div>
    );
  }

  return <>{children}</>;
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

console.log('Mounting React app to #root');
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ClientErrorWrapper>
      <App />
    </ClientErrorWrapper>
  </React.StrictMode>
);
// confirm mount
console.log('React render called');
