import { handle } from 'hono/vercel';
import { Hono } from 'hono';
import { trpcServer } from '@hono/trpc-server';
import { cors } from 'hono/cors';
import { appRouter } from '../backend/trpc/app-router';
import { createContext } from '../backend/trpc/create-context';

const app = new Hono().basePath('/api');

app.use('*', cors({
  origin: (origin) => {
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return origin;
    }
    if (origin.includes('.vercel.app') || origin.includes('.rork.live') || origin.includes('.e2b.app')) {
      return origin;
    }
    return origin;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext,
    onError: ({ error, path }) => {
      console.error('=== tRPC Error ===');
      console.error('Path:', path);
      console.error('Error:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    },
  })
);

app.get('/', (c) => {
  console.log('Health check hit at /api/');
  return c.json({ status: 'ok', message: 'API is running', timestamp: new Date().toISOString() });
});

app.all('*', (c) => {
  console.log('Unhandled request:', c.req.method, c.req.url, 'path:', c.req.path);
  return c.json({ error: 'Not Found', path: c.req.path, url: c.req.url, method: c.req.method }, 404);
});

console.log('API handler loaded and configured');

export default handle(app);