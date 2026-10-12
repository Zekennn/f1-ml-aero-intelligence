import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */

// Where the FastAPI backend (backend/main.py) is running.
// Override with:  BACKEND_URL=http://host:port npm run dev
const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

const nextConfig = {
  // This folder is the project root (silences the "multiple lockfiles" warning)
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),

  // Every request to /backend/* is forwarded to FastAPI, so the browser
  // only ever talks to this site (no CORS setup needed).
  async rewrites() {
    return [{ source: "/backend/:path*", destination: `${BACKEND_URL}/:path*` }];
  },

  // Keep the old FastAPI page URL working
  async redirects() {
    return [{ source: "/drivers-champ", destination: "/predictor", permanent: false }];
  },
};

export default nextConfig;
