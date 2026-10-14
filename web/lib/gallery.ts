// Server-only: lists the photos in public/img for the home page gallery.
// Drop new .jpg/.png/.webp files into web/public/img and they appear on the next page load
// (on Vercel, after the next deploy: see lib/media.ts).
import path from "node:path";
import { imageSize } from "./imageSize.mjs";
import { listPublic, mediaManifest, publicFolderReadable } from "./media";

export type GalleryPhoto = { src: string; width: number; height: number; alt: string };

const DIR = path.join(process.cwd(), "public", "img");
const TYPES = /\.(jpe?g|png|webp)$/i;

const photo = (name: string, width: number, height: number, i: number): GalleryPhoto => ({
  src: `/img/${encodeURIComponent(name)}`,
  width,
  height,
  alt: `Paddock photo ${i + 1}`,
});

export async function getGalleryPhotos(): Promise<GalleryPhoto[]> {
  // Inside a Vercel function public/ isn't available: use the sizes recorded at build time
  if (!publicFolderReadable("img")) {
    return (mediaManifest()?.gallery ?? []).map((g, i) => photo(g.name, g.width, g.height, i));
  }
  const names = listPublic("img").filter((n) => TYPES.test(n)).sort();
  return Promise.all(
    names.map(async (name, i) => {
      const size = await imageSize(path.join(DIR, name)).catch(() => null);
      return photo(name, size?.width ?? 1080, size?.height ?? 1350, i);
    }),
  );
}
