import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { checkAuth, storeAuthState } from '../../src/utils/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  loginPath?: string;
  authEndpoint?: string;
  loadingComponent?: React.ReactNode;
}

/**
 * Protected route component that checks authentication before rendering children
 * Redirects to login page if not authenticated
 */
export function ProtectedRoute({ 
  children, 
  loginPath = '/login',
  authEndpoint = '/api/auth/check',
  loadingComponent
}: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [checkComplete, setCheckComplete] = useState(false);

  useEffect(() => {
    const performAuthCheck = async () => {
      try {
        const result = await checkAuth(authEndpoint);
        setIsAuthenticated(result.authenticated);
        storeAuthState(result.authenticated, result.username);
      } catch (error) {
        console.error('Auth check failed:', error);
        setIsAuthenticated(false);
        storeAuthState(false);
      } finally {
        setCheckComplete(true);
      }
    };

    performAuthCheck();
  }, [authEndpoint]);

  // Show loading state while checking authentication
  if (!checkComplete) {
    return loadingComponent || (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to={loginPath} replace />;
  }

  // Render protected content
  return <>{children}</>;
}

export default ProtectedRoute;