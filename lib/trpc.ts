import { createTRPCReact } from '@trpc/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@/backend/trpc/app-router';
import superjson from 'superjson';

const getBaseUrl = () => {
  if (typeof window === 'undefined') {
    return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
  }
  
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  if (isDev) {
    return 'http://localhost:3001';
  }
  
  console.log('Production mode - using same origin for API:', window.location.origin);
  return window.location.origin;
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
          console.log('Request method:', options?.method);
          console.log('Request headers:', options?.headers);
          
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
          
          console.log('tRPC response status:', response.status);
          console.log('tRPC response content-type:', response.headers.get('content-type'));
          
          const contentType = response.headers.get('content-type');
          
          if (!response.ok) {
            const clonedResponse = response.clone();
            const text = await clonedResponse.text();
            console.error('tRPC error response:', text.substring(0, 500));
            throw new Error(`Backend error (${response.status}): ${text.substring(0, 100)}`);
          }
          
          if (contentType && contentType.includes('text/html')) {
            const clonedResponse = response.clone();
            const text = await clonedResponse.text();
            console.error('Received HTML response instead of JSON:', text.substring(0, 200));
            throw new Error('Backend server is not responding correctly. Please check if the server is running.');
          }
          
          return response;
        } catch (error) {
          console.error('tRPC fetch error:', error);
          backendAvailable = false;
          throw error;
        }
      },
    }),
  ],
});