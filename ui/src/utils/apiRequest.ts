/**
 * API Request Utility
 * Standardized fetch wrapper with error handling and type safety
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: string[];
}

export interface ApiRequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export class ApiError extends Error {
  public status: number;
  public details?: string[];
  
  constructor(message: string, status: number, details?: string[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Get the API base URL based on environment
 */
function getApiBaseUrl(): string {
  // Check if running in Tauri desktop app
  if (window.__TAURI__) {
    return 'http://localhost:3000';
  }
  
  // Check for environment variable
  if (import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Default to relative URL for same-origin requests
  return '';
}

/**
 * Make an API request with standardized error handling
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const {
    timeout = 30000,
    retries = 0,
    retryDelay = 1000,
    ...fetchOptions
  } = options;
  
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  
  // Default headers
  const headers = new Headers(fetchOptions.headers);
  if (!headers.has('Content-Type') && fetchOptions.body && typeof fetchOptions.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  let lastError: Error | null = null;
  
  // Attempt request with retries
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Parse response
      const contentType = response.headers.get('content-type');
      let data: any;
      
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
      
      // Check for API response format
      if (typeof data === 'object' && 'success' in data) {
        const apiResponse = data as ApiResponse<T> & Record<string, any>;
        
        if (!apiResponse.success) {
          throw new ApiError(
            apiResponse.error || apiResponse.message || 'Request failed',
            response.status,
            apiResponse.details
          );
        }

        const inferred =
          apiResponse.data ??
          apiResponse.logs ??
          apiResponse.files ??
          apiResponse.entries ??
          apiResponse.items ??
          apiResponse;
        
        return inferred as T;
      }
      
      // Handle non-standard responses
      if (!response.ok) {
        throw new ApiError(
          data.message || data.error || `HTTP ${response.status}`,
          response.status
        );
      }
      
      return data as T;
      
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on certain errors
      if (error instanceof ApiError && error.status < 500) {
        throw error;
      }
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError('Request timeout', 408);
      }
      
      // Wait before retry
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }
  }
  
  clearTimeout(timeoutId);
  
  // All retries failed
  throw lastError || new ApiError('Request failed', 500);
}

/**
 * Convenience methods for common HTTP verbs
 */
export const api = {
  get<T = any>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return apiRequest<T>(endpoint, { ...options, method: 'GET' });
  },
  
  post<T = any>(endpoint: string, body?: any, options?: ApiRequestOptions): Promise<T> {
    return apiRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body)
    });
  },
  
  put<T = any>(endpoint: string, body?: any, options?: ApiRequestOptions): Promise<T> {
    return apiRequest<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: typeof body === 'string' ? body : JSON.stringify(body)
    });
  },
  
  patch<T = any>(endpoint: string, body?: any, options?: ApiRequestOptions): Promise<T> {
    return apiRequest<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: typeof body === 'string' ? body : JSON.stringify(body)
    });
  },
  
  delete<T = any>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return apiRequest<T>(endpoint, { ...options, method: 'DELETE' });
  }
};

/**
 * Hook for API requests with loading and error states (for React)
 */
export function useApiRequest<T = any>() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [data, setData] = React.useState<T | null>(null);
  
  const execute = React.useCallback(async (
    endpoint: string,
    options?: ApiRequestOptions
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiRequest<T>(endpoint, options);
      setData(result);
      return result;
    } catch (err) {
      const apiError = err instanceof ApiError ? err : new ApiError(
        (err as Error).message,
        500
      );
      setError(apiError);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  
  return { execute, loading, error, data };
}

// Add React import for hook
import * as React from 'react';

export default api;
