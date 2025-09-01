/**
 * API Readiness Utility
 * Handles checking if the API server is ready before making requests
 */

// API_URL should be provided by the consuming application

interface ApiReadinessResult {
    ready: boolean;
    error?: string;
    retryAfter?: number;
}

/**
 * Check if the API server is ready to accept requests
 */
export async function checkApiReadiness(apiUrl = '', timeout = 5000): Promise<ApiReadinessResult> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(`${apiUrl}/api/health`, {
            signal: controller.signal,
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const healthData = await response.json();
            // API is ready as long as it responds, regardless of health status
            return {
                ready: true
            };
        } else {
            return {
                ready: false,
                error: `Server returned ${response.status}: ${response.statusText}`,
                retryAfter: 2000
            };
        }
        
    } catch (error: any) {
        if (error.name === 'AbortError') {
            return {
                ready: false,
                error: 'Request timeout',
                retryAfter: 3000
            };
        }
        
        if (error.code === 'ECONNREFUSED' || error.message.includes('fetch')) {
            return {
                ready: false,
                error: 'Server not ready',
                retryAfter: 2000
            };
        }
        
        return {
            ready: false,
            error: error.message,
            retryAfter: 5000
        };
    }
}

/**
 * Wait for API to be ready with exponential backoff
 */
export async function waitForApiReady(
    apiUrl = '',
    maxAttempts = 10,
    initialDelay = 1000,
    maxDelay = 10000
): Promise<boolean> {
    let attempts = 0;
    let delay = initialDelay;
    
    while (attempts < maxAttempts) {
        attempts++;
        
        console.log(`🔍 Checking API readiness (attempt ${attempts}/${maxAttempts})...`);
        
        const result = await checkApiReadiness(apiUrl);
        
        if (result.ready) {
            console.log('✅ API is ready!');
            return true;
        }
        
        console.log(`⏳ API not ready: ${result.error}. Retrying in ${delay}ms...`);
        
        if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(delay * 2, maxDelay);
        }
    }
    
    console.error('❌ API failed to become ready after all attempts');
    return false;
}

/**
 * Enhanced fetch with API readiness check
 */
export async function apiRequest<T = any>(
    apiUrl: string,
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    // Check API readiness first
    const readiness = await checkApiReadiness(apiUrl);
    
    if (!readiness.ready) {
        throw new Error(`API not ready: ${readiness.error}`);
    }
    
    const url = endpoint.startsWith('http') ? endpoint : `${apiUrl}${endpoint}`;
    
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
    
    if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
}
