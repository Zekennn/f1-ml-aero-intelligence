import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */

// Where the FastAPI backend (backend/main.py) is running, if at all. The website doesn't need it:
// every page reads the committed JSON in data/ and public/data/. It only matters locally (dev.ps1).
// On Vercel there is no backend, so the proxy is only added when BACKEND_URL is set there.
const BACKEND_URL = process.env.BACKEND_URL || (process.env.VERCEL ? "" : "http://127.0.0.1:8000");

const nextConfig = {
  // This folder is the project root (silences the "multiple lockfiles" warning)
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),

  // Pages rendered on request (home, predictor) read these files at runtime. On Vercel they run as
  // serverless functions, which only contain files the build can trace, so list them explicitly.
  // (public/ images are served by the CDN; lib/media.ts finds their names via data/media-manifest.json.)
  outputFileTracingIncludes: {
    "**": ["./data/*.json", "./public/data/circuits/*.json"],
  },
  // ...but not the photos: the CDN serves them, and ~55 MB in every function would slow cold starts
  outputFileTracingExcludes: {
    "**": ["./public/img/**/*", "./public/images/**/*"],
  },

  // Every request to /backend/* is forwarded to FastAPI, so the browser
  // only ever talks to this site (no CORS setup needed).
  async rewrites() {
    return BACKEND_URL ? [{ source: "/backend/:path*", destination: `${BACKEND_URL}/:path*` }] : [];
  },

  // Keep the old FastAPI page URL working
  async redirects() {
    return [{ source: "/drivers-champ", destination: "/predictor", permanent: false }];
  },
};

export default nextConfig;
