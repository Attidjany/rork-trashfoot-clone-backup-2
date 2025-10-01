import { createTRPCReact } from '@trpc/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@/backend/trpc/app-router';
import superjson from 'superjson';

const getBaseUrl = () => {
  if (typeof window === 'undefined') {
    return process.env.EXPO_PUBLIC_API_URL || 'https://trashfoot.vercel.app';
  }
  
  const origin = window.location.origin;
  console.log('Using same origin for API:', origin);
  return origin;
};

const checkBackend = async () => {
  try {
    const baseUrl = getBaseUrl();
    console.log('\n=== BACKEND HEALTH CHECK ===');
    console.log('Checking backend at:', `${baseUrl}/api/`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${baseUrl}/api/`, { 
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    const contentType = response.headers.get('content-type');
    const responseText = await response.text();
    
    console.log('Backend check response:', {
      ok: response.ok,
      status: response.status,
      contentType,
      responsePreview: responseText.substring(0, 200)
    });
    
    if (response.ok && contentType?.includes('application/json')) {
      console.log('✅ Backend is healthy and responding correctly');
      return true;
    } else {
      console.error('❌ Backend is not responding correctly');
      console.error('Expected JSON response, got:', contentType);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Backend health check failed:', error);
    return false;
  }
};

if (typeof window !== 'undefined') {
  checkBackend().then(isHealthy => {
    if (!isHealthy) {
      console.error('\n⚠️  BACKEND ISSUE DETECTED!');
      console.error('The backend API is not responding correctly.');
      console.error('\nPossible causes:');
      console.error('  1. Vercel deployment failed or is still deploying');
      console.error('  2. API function has errors (check Vercel logs)');
      console.error('  3. Environment variables not set correctly');
      console.error('\nTo fix:');
      console.error('  1. Check Vercel deployment status');
      console.error('  2. Visit https://trashfoot.vercel.app/api/ to test the API');
      console.error('  3. Check Vercel function logs for errors\n');
    }
  });
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
            console.error('Full URL that failed:', url);
            console.error('Request body:', options?.body);
            
            if (text.includes('ngrok')) {
              throw new Error('Backend is using ngrok which is not running. Please deploy to Vercel or start local backend.');
            }
            
            if (response.status === 503) {
              throw new Error('Backend service unavailable (503). Please check your Vercel deployment.');
            }
            
            if (response.status === 404) {
              console.error('404 Error - tRPC endpoint not found');
              console.error('This usually means:');
              console.error('1. Vercel deployment is incomplete');
              console.error('2. API routes are not properly configured');
              console.error('3. The /api/trpc path is not being routed correctly');
              throw new Error('tRPC endpoint not found (404). Please check Vercel deployment and ensure the API is properly deployed.');
            }
            
            throw new Error(`Backend error (${response.status}): ${text.substring(0, 100)}`);
          }
          
          if (contentType && contentType.includes('text/html')) {
            const clonedResponse = response.clone();
            const text = await clonedResponse.text();
            console.error('Received HTML response instead of JSON:', text.substring(0, 200));
            
            if (text.includes('ngrok')) {
              console.error('\n⚠️  NGROK NOT RUNNING!');
              console.error('Your backend is configured to use ngrok but it\'s not running.');
              console.error('Options:');
              console.error('  1. Start ngrok and update EXPO_PUBLIC_API_URL');
              console.error('  2. Deploy to Vercel (recommended)');
              console.error('  3. Use local development: bash dev.sh\n');
              throw new Error('Backend ngrok tunnel is not running. Please deploy to Vercel or start local backend.');
            }
            
            console.error('\n⚠️  BACKEND NOT RESPONDING!');
            console.error('The backend is returning HTML instead of JSON.');
            console.error('This usually means:');
            console.error('  1. Backend is not deployed to Vercel');
            console.error('  2. Vercel deployment failed');
            console.error('  3. API routes are not configured correctly\n');
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