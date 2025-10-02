import { createTRPCReact } from '@trpc/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@/backend/trpc/app-router';
import superjson from 'superjson';
import { supabase } from './supabase';

const getBaseUrl = () => {
  if (typeof window === 'undefined') {
    return 'https://trashfoot.vercel.app';
  }
  
  const origin = window.location.origin;
  console.log('Using same origin for API:', origin);
  return origin;
};

const checkBackend = async () => {
  try {
    const baseUrl = getBaseUrl();
    console.log('=== BACKEND HEALTH CHECK ===');
    console.log('Checking backend at:', `${baseUrl}/api/`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${baseUrl}/api/`, { 
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    const contentType = response.headers.get('content-type');
    
    if (response.ok && contentType?.includes('application/json')) {
      const data = await response.json();
      console.log('✅ Backend is healthy:', data.message);
      return true;
    } else {
      console.error('❌ Backend health check failed');
      console.error('Status:', response.status);
      console.error('Content-Type:', contentType);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Backend health check error:', error);
    return false;
  }
};

if (typeof window !== 'undefined') {
  setTimeout(() => {
    checkBackend().then(isHealthy => {
      if (!isHealthy) {
        console.error('⚠️  Backend may not be ready. Check Vercel deployment.');
      }
    });
  }, 1000);
}

const trpcUrl = `${getBaseUrl()}/api/trpc`;
console.log('TRPC URL:', trpcUrl);

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: trpcUrl,
      transformer: superjson,
      async headers() {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        
        if (token) {
          console.log('✅ Adding auth token to tRPC request');
          return {
            authorization: `Bearer ${token}`,
          };
        }
        
        console.log('⚠️  No auth token available for tRPC request');
        return {};
      },
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
            console.error('tRPC error:', response.status, text.substring(0, 200));
            throw new Error(`Backend error (${response.status})`);
          }
          
          if (contentType && contentType.includes('text/html')) {
            console.error('Received HTML instead of JSON - backend may not be deployed');
            throw new Error('Backend is not responding correctly. Please check Vercel deployment.');
          }
          
          return response;
        } catch (error) {
          console.error('tRPC fetch error:', error);
          throw error;
        }
      },
    }),
  ],
});