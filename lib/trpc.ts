import { createTRPCReact } from '@trpc/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@/backend/trpc/app-router';
import superjson from 'superjson';

const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // In the browser, use the current origin
    return window.location.origin;
  }
  // For SSR/mobile, use environment variable or default
  return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
};

// Check if backend is available
let backendAvailable = false;
const checkBackend = async () => {
  try {
    const baseUrl = getBaseUrl();
    console.log('Checking backend at:', `${baseUrl}/api/`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${baseUrl}/api/`, { 
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    backendAvailable = response.ok;
    const responseText = await response.text();
    
    console.log('Backend check response:', {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get('content-type'),
      responseText: responseText.substring(0, 200)
    });
    
  } catch (error) {
    backendAvailable = false;
    console.log('Backend not available:', error);
  }
};

// Check backend availability on startup
if (typeof window !== 'undefined') {
  checkBackend();
}

const trpcUrl = `${getBaseUrl()}/api/trpc`;
console.log('TRPC URL:', trpcUrl);

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: trpcUrl,
      transformer: superjson,
      fetch: async (url, options) => {
        try {
          console.log('tRPC fetch to:', url);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              ...options?.headers,
            },
          });
          
          clearTimeout(timeoutId);
          
          console.log('tRPC response status:', response.status, 'content-type:', response.headers.get('content-type'));
          
          // Check if response is HTML (error page)
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('text/html')) {
            const text = await response.text();
            console.error('Received HTML response instead of JSON:', text.substring(0, 200));
            throw new Error('Backend server is not responding correctly. Please check if the server is running.');
          }
          
          return response;
        } catch (error) {
          console.error('tRPC fetch error:', error);
          // Mark backend as unavailable for future requests
          backendAvailable = false;
          throw error;
        }
      },
    }),
  ],
});