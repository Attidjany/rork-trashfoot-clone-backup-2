import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { trpcServer } from '@hono/trpc-server';
import { cors } from 'hono/cors';
import { appRouter } from './backend/trpc/app-router';
import { createContext } from './backend/trpc/create-context';

const app = new Hono();

// Enable CORS for all routes
app.use('*', cors({
  origin: ['http://localhost:8081', 'http://localhost:3000'],
  credentials: true,
}));

// Mount tRPC router at /api/trpc
app.use(
  '/api/trpc/*',
  trpcServer({
    router: appRouter,
    createContext,
  })
);

// Simple health check endpoint
app.get('/api', (c) => {
  return c.json({ status: 'ok', message: 'API is running' });
});

const port = 3001;

console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});