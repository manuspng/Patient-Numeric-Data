import React, { Component, ErrorInfo, ReactNode } from 'react';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error handlers to capture non-react startup errors
window.addEventListener('error', (event) => {
  const rootEl = document.getElementById('root');
  if (rootEl) {
    rootEl.innerHTML = `
      <div style="padding: 24px; background: #fff5f5; color: #c53030; font-family: system-ui, -apple-system, monospace; border: 1px solid #feb2b2; margin: 24px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <h3 style="margin-top: 0; font-size: 18px; font-weight: bold; color: #9b2c2c;">⚠️ Chikitsa Sahayak - Runtime Error</h3>
        <p><strong>Message:</strong> ${event.message}</p>
        <p><strong>Location:</strong> ${event.filename || 'unknown'}:${event.lineno || 0}:${event.colno || 0}</p>
        <pre style="background: #fff; padding: 12px; border-radius: 6px; overflow: auto; border: 1px solid #fed7d7; font-size: 12px; line-height: 1.5; max-height: 400px;">${event.error?.stack || 'No stack trace available'}</pre>
        <button onclick="window.location.reload()" style="background: #c53030; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 12px;">Reload Application</button>
      </div>
    `;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const rootEl = document.getElementById('root');
  if (rootEl) {
    const errorMsg = event.reason?.message || String(event.reason);
    rootEl.innerHTML = `
      <div style="padding: 24px; background: #fff5f5; color: #c53030; font-family: system-ui, -apple-system, monospace; border: 1px solid #feb2b2; margin: 24px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <h3 style="margin-top: 0; font-size: 18px; font-weight: bold; color: #9b2c2c;">⚠️ Chikitsa Sahayak - Unhandled Rejection</h3>
        <p><strong>Reason:</strong> ${errorMsg}</p>
        <pre style="background: #fff; padding: 12px; border-radius: 6px; overflow: auto; border: 1px solid #fed7d7; font-size: 12px; line-height: 1.5; max-height: 400px;">${event.reason?.stack || 'No stack trace available'}</pre>
        <button onclick="window.location.reload()" style="background: #c53030; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 12px;">Reload Application</button>
      </div>
    `;
  }
});

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("React Error Boundary caught an error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "24px", background: "#fff5f5", color: "#c53030", fontFamily: "system-ui, -apple-system, monospace", border: "1px solid #feb2b2", margin: "24px", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
          <h3 style={{ marginTop: 0, fontSize: "18px", fontWeight: "bold", color: "#9b2c2c" }}>⚠️ Chikitsa Sahayak - Component Render Error</h3>
          <p><strong>Message:</strong> {this.state.error?.toString()}</p>
          <pre style={{ background: "#fff", padding: "12px", borderRadius: "6px", overflow: "auto", border: "1px solid #fed7d7", fontSize: "12px", lineHeight: "1.5", maxHeight: "400px" }}>
            {this.state.errorInfo?.componentStack || this.state.error?.stack || "No additional trace info"}
          </pre>
          <button onClick={() => window.location.reload()} style={{ background: "#c53030", color: "white", border: "none", padding: "10px 20px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", marginTop: "12px" }}>
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
