/**
 * Authentication utilities for framework applications
 */

interface AuthCheckResult {
  authenticated: boolean;
  username?: string;
  error?: string;
}

/**
 * Check if the user is authenticated
 * @param authEndpoint - The endpoint to check authentication status
 * @returns Promise with authentication status
 */
export async function checkAuth(
  authEndpoint: string = '/api/auth/check'
): Promise<AuthCheckResult> {
  try {
    const response = await fetch(authEndpoint, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        authenticated: data.authenticated,
        username: data.username
      };
    } else if (response.status === 401) {
      return {
        authenticated: false
      };
    } else {
      return {
        authenticated: false,
        error: `Server returned ${response.status}`
      };
    }
  } catch (error: any) {
    return {
      authenticated: false,
      error: error.message || 'Failed to check authentication'
    };
  }
}

/**
 * Log out the current user
 * @param logoutEndpoint - The endpoint to log out
 * @returns Promise with logout result
 */
export async function logout(
  logoutEndpoint: string = '/api/logout'
): Promise<boolean> {
  try {
    const response = await fetch(logoutEndpoint, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      // Clear local storage
      localStorage.removeItem('authenticated');
      localStorage.removeItem('username');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Logout failed:', error);
    return false;
  }
}

/**
 * Store authentication state in localStorage
 * @param authenticated - Whether the user is authenticated
 * @param username - The username of the authenticated user
 */
export function storeAuthState(authenticated: boolean, username?: string): void {
  if (authenticated) {
    localStorage.setItem('authenticated', 'true');
    if (username) {
      localStorage.setItem('username', username);
    }
  } else {
    localStorage.removeItem('authenticated');
    localStorage.removeItem('username');
  }
}

/**
 * Get stored authentication state
 * @returns The stored authentication state
 */
export function getStoredAuthState(): { authenticated: boolean; username?: string } {
  const authenticated = localStorage.getItem('authenticated') === 'true';
  const username = localStorage.getItem('username') || undefined;
  return { authenticated, username };
}

/**
 * Make an authenticated API request
 * @param url - The URL to request
 * @param options - Fetch options
 * @returns Promise with the response
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
}

/**
 * Make an authenticated API request and parse JSON
 * @param url - The URL to request
 * @param options - Fetch options
 * @returns Promise with the parsed JSON data
 */
export async function authenticatedRequest<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await authenticatedFetch(url, options);
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}