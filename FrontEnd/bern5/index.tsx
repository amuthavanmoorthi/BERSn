
import React from 'react';
import ReactDOM from 'react-dom/client';

import { SessionProvider } from './context/SessionContext';
import AppRouter from './routes/AppRouter';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// SessionProvider must wrap AppRouter — the route guards read
// session state via useSession() at render time, so context has to be
// available before any <Route> element resolves.
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <SessionProvider>
      <AppRouter />
    </SessionProvider>
  </React.StrictMode>
);
