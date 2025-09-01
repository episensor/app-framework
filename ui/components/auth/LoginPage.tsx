import React, { useState } from 'react';
import { Button } from '../base/button';
import { Input } from '../base/input';
import { ImageWithFallback } from '../base/ImageWithFallback';
import { AlertCircle, Globe } from 'lucide-react';

export interface LoginPageConfig {
  apiEndpoint?: string;
  logoSrc?: string;
  fallbackLogoSrc?: string;
  appTitle?: string;
  subtitle?: string;
  showLanguageSelector?: boolean;
  showPoweredBy?: boolean;
  poweredByLogo?: string;
  poweredByText?: string;
  onLoginSuccess?: () => void;
  onLoginError?: (error: string) => void;
  customStyles?: {
    container?: string;
    card?: string;
    logo?: string;
    title?: string;
    subtitle?: string;
    errorMessage?: string;
    input?: string;
    button?: string;
  };
}

export interface LoginPageProps extends LoginPageConfig {
  navigate: (path: string) => void;
}

export function LoginPage({
  apiEndpoint = '/api/login',
  logoSrc = '/assets/logo.png',
  fallbackLogoSrc = '/assets/episensor.svg',
  appTitle = 'Application',
  subtitle = 'Sign in to continue',
  showLanguageSelector = false,
  showPoweredBy = false,
  poweredByLogo = '/assets/episensor.svg',
  poweredByText = 'Powered by',
  onLoginSuccess,
  onLoginError,
  customStyles = {},
  navigate
}: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }
    
    setLoading(true);

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Store auth state
        localStorage.setItem('authenticated', 'true');
        if (onLoginSuccess) {
          onLoginSuccess();
        }
        navigate('/');
      } else {
        const errorMsg = data.error || 'Invalid credentials';
        setError(errorMsg);
        if (onLoginError) {
          onLoginError(errorMsg);
        }
      }
    } catch (error) {
      const errorMsg = 'Login failed. Please try again.';
      setError(errorMsg);
      console.error('Login error:', error);
      if (onLoginError) {
        onLoginError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={customStyles.container || "min-h-screen flex items-center justify-center bg-gray-50"}>
      <div className={customStyles.card || "max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-sm border border-gray-200"}>
        <div className="flex flex-col items-center">
          <ImageWithFallback
            src={logoSrc} 
            fallbackSrc={fallbackLogoSrc}
            alt="Logo" 
            className={customStyles.logo || "h-12 mb-6"}
          />
          <h1 className={customStyles.title || "text-2xl font-semibold text-gray-900"}>{appTitle}</h1>
          <p className={customStyles.subtitle || "text-sm text-gray-500 mt-2"}>{subtitle}</p>
        </div>
        
        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className={customStyles.errorMessage || "flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"}>
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <Input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className={customStyles.input || "w-full"}
                disabled={loading}
                autoFocus
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className={customStyles.input || "w-full"}
                disabled={loading}
              />
            </div>

            {showLanguageSelector && (
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                  onClick={() => console.log('Language selector clicked')}
                >
                  <Globe className="h-4 w-4" />
                  <span>English</span>
                </button>
              </div>
            )}
          </div>

          <Button
            type="submit"
            className={customStyles.button || "w-full"}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        {showPoweredBy && (
          <div className="flex items-center justify-center pt-6 border-t border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>{poweredByText}</span>
              <ImageWithFallback
                src={poweredByLogo} 
                alt="Powered by" 
                className="h-5"
                hideOnError={true}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}