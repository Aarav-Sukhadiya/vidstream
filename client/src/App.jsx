import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AppShell from './components/AppShell';
import ErrorBoundary from './components/ErrorBoundary';
import GuestRoute from './components/GuestRoute';
import ProtectedRoute from './components/ProtectedRoute';
import Spinner from './components/Spinner';
import Home from './pages/Home';

// Route-level code splitting: heavy pages (e.g. Watch with hls.js) load on demand
const Search = lazy(() => import('./pages/Search'));
const Watch = lazy(() => import('./pages/Watch'));
const Channel = lazy(() => import('./pages/Channel'));
const Subscriptions = lazy(() => import('./pages/Subscriptions'));
const History = lazy(() => import('./pages/History'));
const Liked = lazy(() => import('./pages/Liked'));
const Upload = lazy(() => import('./pages/Upload'));
const Studio = lazy(() => import('./pages/Studio'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const NotFound = lazy(() => import('./pages/NotFound'));

const protectedPage = (Page) => (
  <ProtectedRoute>
    <Page />
  </ProtectedRoute>
);

const guestPage = (Page) => (
  <GuestRoute>
    <Page />
  </GuestRoute>
);

function AppRoutes() {
  const location = useLocation();

  return (
    // Keyed by path so an error on one page doesn't stick after navigating away
    <ErrorBoundary key={location.pathname}>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/watch/:id" element={<Watch />} />
          <Route path="/c/:handle" element={<Channel />} />
          <Route path="/subscriptions" element={protectedPage(Subscriptions)} />
          <Route path="/history" element={protectedPage(History)} />
          <Route path="/liked" element={protectedPage(Liked)} />
          <Route path="/upload" element={protectedPage(Upload)} />
          <Route path="/studio" element={protectedPage(Studio)} />
          <Route path="/login" element={guestPage(Login)} />
          <Route path="/register" element={guestPage(Register)} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </AuthProvider>
    </BrowserRouter>
  );
}
