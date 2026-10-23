/** Server-side upload checks. The declared MIME type is never trusted; the file's bytes decide. */
export type FileKind = "pdf" | "png" | "jpeg" | "webp";

const MIME: Record<FileKind, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0): boolean =>
  signature.every((value, i) => bytes[offset + i] === value);

export function sniffKind(bytes: Uint8Array): FileKind | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // %PDF-
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  return null;
}

export type FileCheck = { ok: true; mimeType: string } | { ok: false; reason: string };

export function checkInvoiceFile(bytes: Uint8Array, maxBytes: number): FileCheck {
  if (bytes.byteLength === 0) return { ok: false, reason: "The file is empty." };
  if (bytes.byteLength > maxBytes) {
    return { ok: false, reason: `The file is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.` };
  }
  const kind = sniffKind(bytes);
  return kind ? { ok: true, mimeType: MIME[kind] } : { ok: false, reason: "Only PDF, PNG, JPEG or WebP files are accepted." };
}

/** Keep file names short and free of path or markup characters before echoing them back. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^A-Za-z0-9._ -]/g, "_").slice(0, 80) || "file";
}

/** Base64 without Buffer so the same code runs on Node, Vercel and edge runtimes. */
export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
