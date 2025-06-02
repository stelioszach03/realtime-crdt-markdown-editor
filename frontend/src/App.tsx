/**
 * Main App component with routing
 */
import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuthSimplified';
import { Navbar } from './components/Layout/Navbar';
import { LoadingSpinner } from './components/Shared/LoadingSpinner';
import { ComponentErrorBoundary } from './components/Shared/ErrorBoundary';

// Lazy load route components
const Home = lazy(() => import('./routes/Home').then(module => ({ default: module.Home })));
const DocumentRoom = lazy(() => import('./routes/DocumentRoom').then(module => ({ default: module.DocumentRoom })));
const NewDocument = lazy(() => import('./routes/NewDocument').then(module => ({ default: module.NewDocument })));

// Protected route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Public route wrapper (redirects authenticated users)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoading, isAuthenticated } = useAuth();
  
  console.log('[PublicRoute] isLoading:', isLoading, 'isAuthenticated:', isAuthenticated);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return <>{children}</>;
};

// Loading fallback component
const PageLoadingFallback: React.FC = () => (
  <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
    <LoadingSpinner />
  </div>
);

const App: React.FC = () => {
  console.log('[APP] App component rendering');
  
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <Navbar />
      
      <main className="flex-1">
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            {/* Public routes */}
            <Route
              path="/"
              element={
                <PublicRoute>
                  <ComponentErrorBoundary componentName="Home">
                    <Home />
                  </ComponentErrorBoundary>
                </PublicRoute>
              }
            />

            {/* Protected routes */}
            <Route
              path="/new"
              element={
                <ProtectedRoute>
                  <ComponentErrorBoundary componentName="NewDocument">
                    <NewDocument />
                  </ComponentErrorBoundary>
                </ProtectedRoute>
              }
            />

            <Route
              path="/r/:documentId"
              element={
                <ProtectedRoute>
                  <ComponentErrorBoundary componentName="DocumentRoom">
                    <DocumentRoom />
                  </ComponentErrorBoundary>
                </ProtectedRoute>
              }
            />

            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
};

export default App;