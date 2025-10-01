import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

const app = new Hono();

app.use("*", cors({
  origin: (origin) => {
    if (!origin) return origin;
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) return origin;
    if (origin.includes('.vercel.app') || origin.includes('.rork.live') || origin.includes('.e2b.app')) return origin;
    return origin;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext,
    onError: ({ error, path }) => {
      console.error('tRPC Error on path:', path);
      console.error('Error:', error);
    },
  })
);

app.get("/", (c) => {
  console.log('Health check endpoint hit');
  return c.json({ status: "ok", message: "API is running", timestamp: new Date().toISOString() });
});

app.get("/debug", (c) => {
  console.log('Debug endpoint hit');
  const headers = c.req.header();
  return c.json({ 
    status: "debug", 
    message: "Debug endpoint working",
    headers: headers,
    url: c.req.url,
    method: c.req.method
  });
});

app.all('*', (c) => {
  console.log('Unhandled request:', c.req.method, c.req.url);
  return c.json({ error: 'Not Found', path: c.req.url }, 404);
});

export default app;