// Server-only: lists the photos in public/img for the home page gallery.
// Drop new .jpg/.png/.webp files into web/public/img and they appear on the next page load.
import { open, readdir } from "node:fs/promises";
import path from "node:path";

export type GalleryPhoto = { src: string; width: number; height: number; alt: string };

const DIR = path.join(process.cwd(), "public", "img");
const TYPES = /\.(jpe?g|png|webp)$/i;

/** Pixel size from the file header (JPEG SOF, PNG IHDR, WebP VP8/VP8L/VP8X), without decoding the image. */
async function imageSize(file: string): Promise<{ width: number; height: number } | null> {
  const fh = await open(file, "r");
  try {
    const head = Buffer.alloc(512 * 1024); // big EXIF blocks can push the frame header past 64 KB
    const { bytesRead } = await fh.read(head, 0, head.length, 0);
    const b = head.subarray(0, bytesRead);
    // PNG
    if (b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
    // WebP
    if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
      const kind = b.toString("ascii", 12, 16);
      if (kind === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
      if (kind === "VP8L") {
        const bits = b.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      if (kind === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    }
    // JPEG: walk the markers to the first start-of-frame
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const marker = b[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
        }
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
    return null;
  } finally {
    await fh.close();
  }
}

export async function getGalleryPhotos(): Promise<GalleryPhoto[]> {
  let names: string[] = [];
  try {
    names = (await readdir(DIR)).filter((n) => TYPES.test(n)).sort();
  } catch {
    return []; // no folder yet: the section shows a message
  }
  const photos = await Promise.all(
    names.map(async (name, i) => {
      const size = await imageSize(path.join(DIR, name)).catch(() => null);
      return {
        src: `/img/${encodeURIComponent(name)}`,
        width: size?.width ?? 1080,
        height: size?.height ?? 1350,
        alt: `Paddock photo ${i + 1}`,
      };
    }),
  );
  return photos;
}
