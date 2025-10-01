import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

// Create the app without basePath since Vercel handles the /api mounting
const app = new Hono();

// Enable CORS for all routes
app.use("*", cors({
  origin: (origin, c) => {
    const allowedOrigins = [
      "http://localhost:8081",
      "http://localhost:3000"
    ];
    
    if (!origin) return origin; // Allow requests with no origin (mobile apps)
    if (allowedOrigins.includes(origin)) return origin;
    if (origin.includes('.vercel.app')) return origin;
    if (origin.includes('.rork.live')) return origin;
    
    return null;
  },
  credentials: true,
}));

// Mount tRPC router at /trpc
app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext,
  })
);

// Simple health check endpoint
app.get("/", (c) => {
  console.log('Health check endpoint hit');
  return c.json({ status: "ok", message: "API is running", timestamp: new Date().toISOString() });
});

// Debug endpoint
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

// Export the app for Vercel
export default app;