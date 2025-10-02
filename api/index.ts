import { handle } from 'hono/vercel';
import { Hono } from 'hono';
import { trpcServer } from '@hono/trpc-server';
import { cors } from 'hono/cors';
import { appRouter } from '../backend/trpc/app-router';
import { createContext } from '../backend/trpc/create-context';

const app = new Hono();

app.use('*', cors({
  origin: '*',
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
  return c.json({ 
    status: 'ok', 
    message: 'TrashFoot API is running', 
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/',
      trpc: '/api/trpc'
    }
  });
});

app.all('*', (c) => {
  console.log('Unhandled request:', c.req.method, c.req.url, 'path:', c.req.path);
  return c.json({ 
    error: 'Not Found', 
    path: c.req.path, 
    url: c.req.url, 
    method: c.req.method,
    availableEndpoints: ['/api/', '/api/trpc']
  }, 404);
});

export default handle(app);