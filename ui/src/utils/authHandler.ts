/**
 * Authentication Handler Utilities
 * 
 * Provides common authentication functionality for applications
 */

export interface AuthConfig {
  loginEndpoint?: string;
  logoutEndpoint?: string;
  refreshEndpoint?: string;
  tokenKey?: string;
  authKey?: string;
  tokenExpiry?: number; // in milliseconds
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: {
    username: string;
    email?: string;
    roles?: string[];
  };
  error?: string;
  expiresIn?: number;
}

export class AuthHandler {
  private config: Required<AuthConfig>;
  private refreshTimer?: NodeJS.Timeout;

  constructor(config: AuthConfig = {}) {
    this.config = {
      loginEndpoint: config.loginEndpoint || '/api/login',
      logoutEndpoint: config.logoutEndpoint || '/api/logout',
      refreshEndpoint: config.refreshEndpoint || '/api/refresh',
      tokenKey: config.tokenKey || 'auth_token',
      authKey: config.authKey || 'authenticated',
      tokenExpiry: config.tokenExpiry || 3600000, // 1 hour default
    };
  }

  /**
   * Attempt to log in with credentials
   */
  async login(username: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(this.config.loginEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Store authentication state
        localStorage.setItem(this.config.authKey, 'true');
        
        if (data.token) {
          localStorage.setItem(this.config.tokenKey, data.token);
          this.scheduleTokenRefresh(data.expiresIn || this.config.tokenExpiry);
        }

        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }

        return {
          success: true,
          token: data.token,
          user: data.user,
          expiresIn: data.expiresIn,
        };
      }

      return {
        success: false,
        error: data.error || 'Invalid credentials',
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Login failed. Please try again.',
      };
    }
  }

  /**
   * Log out the current user
   */
  async logout(): Promise<void> {
    try {
      const token = this.getToken();
      
      if (token) {
        await fetch(this.config.logoutEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage
      localStorage.removeItem(this.config.authKey);
      localStorage.removeItem(this.config.tokenKey);
      localStorage.removeItem('user');
      
      // Clear refresh timer
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
      }
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return localStorage.getItem(this.config.authKey) === 'true';
  }

  /**
   * Get the current auth token
   */
  getToken(): string | null {
    return localStorage.getItem(this.config.tokenKey);
  }

  /**
   * Get the current user
   */
  getUser(): any {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Refresh the authentication token
   */
  async refreshToken(): Promise<boolean> {
    try {
      const currentToken = this.getToken();
      if (!currentToken) {
        return false;
      }

      const response = await fetch(this.config.refreshEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          localStorage.setItem(this.config.tokenKey, data.token);
          this.scheduleTokenRefresh(data.expiresIn || this.config.tokenExpiry);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(expiresIn: number): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    // Refresh 5 minutes before expiry
    const refreshTime = Math.max(0, expiresIn - 300000);
    
    this.refreshTimer = setTimeout(() => {
      this.refreshToken();
    }, refreshTime);
  }

  /**
   * Make an authenticated API request
   */
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = this.getToken();
    
    const headers = new Headers(options.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // If unauthorized, try to refresh token and retry
    if (response.status === 401) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        const newToken = this.getToken();
        if (newToken) {
          headers.set('Authorization', `Bearer ${newToken}`);
        }
        
        return fetch(url, {
          ...options,
          headers,
        });
      }
    }

    return response;
  }

  /**
   * Protected route wrapper
   */
  requireAuth(redirectTo: string = '/login'): boolean {
    if (!this.isAuthenticated()) {
      window.location.href = redirectTo;
      return false;
    }
    return true;
  }
}

// Export a default instance
export const authHandler = new AuthHandler();

// Export utility functions for convenience
export const login = (username: string, password: string) => authHandler.login(username, password);
export const logout = () => authHandler.logout();
export const isAuthenticated = () => authHandler.isAuthenticated();
export const getToken = () => authHandler.getToken();
export const getUser = () => authHandler.getUser();
export const authenticatedFetch = (url: string, options?: RequestInit) => authHandler.authenticatedFetch(url, options);