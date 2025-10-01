import { handle } from 'hono/vercel';
import { Hono } from 'hono';
import { trpcServer } from '@hono/trpc-server';
import { cors } from 'hono/cors';
import { appRouter } from '../backend/trpc/app-router';
import { createContext } from '../backend/trpc/create-context';

const app = new Hono();

// Enable CORS for all routes including production domains
app.use('*', cors({
  origin: (origin) => {
    // Allow localhost for development
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return origin;
    }
    // Allow Vercel domains
    if (origin.includes('.vercel.app') || origin.includes('.rork.live')) {
      return origin;
    }
    return origin;
  },
  credentials: true,
}));

// Mount tRPC router at /trpc (since Vercel will prefix with /api)
app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext,
  })
);

// Simple health check endpoint
app.get('/', (c) => {
  return c.json({ status: 'ok', message: 'API is running', timestamp: new Date().toISOString() });
});

console.log('API handler loaded and configured');

export default handle(app);