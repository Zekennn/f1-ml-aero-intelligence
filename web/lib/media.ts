// Server-only: which image files exist in public/, for code that picks images at request time.
//
// Locally (and while building) the folders are read directly. On Vercel, request-time pages run as
// serverless functions that don't contain public/, so this falls back to data/media-manifest.json,
// written by scripts/build-media-manifest.mjs before every build.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export type MediaFolder = "img" | "images/tracks" | "images/drivers";
export type ManifestPhoto = { name: string; width: number; height: number };
type Manifest = { gallery: ManifestPhoto[]; "images/tracks": string[]; "images/drivers": string[] };

let manifest: Manifest | null | undefined;

export function mediaManifest(): Manifest | null {
  if (manifest === undefined) {
    try {
      manifest = JSON.parse(readFileSync(path.join(process.cwd(), "data", "media-manifest.json"), "utf-8")) as Manifest;
    } catch {
      manifest = null;
    }
  }
  return manifest;
}

/** File names in a public/ folder: read live when the folder is there, else from the build manifest. */
export function listPublic(folder: MediaFolder): string[] {
  try {
    return readdirSync(path.join(process.cwd(), "public", folder));
  } catch {
    const m = mediaManifest();
    if (!m) return [];
    return folder === "img" ? m.gallery.map((g) => g.name) : m[folder] ?? [];
  }
}

/** True when the public/ folder itself is readable (local dev, build), false inside a Vercel function. */
export function publicFolderReadable(folder: MediaFolder): boolean {
  try {
    readdirSync(path.join(process.cwd(), "public", folder));
    return true;
  } catch {
    return false;
  }
}
