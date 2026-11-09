/** Browser helper for the media upload endpoint. */
export type UploadResponse = { ok: true; url: string; key: string } | { ok: false; error: string };

export async function uploadImage(file: File): Promise<UploadResponse> {
  const body = new FormData();
  body.append("file", file);
  try {
    const response = await fetch("/api/admin/media", { method: "POST", body });
    const data = (await response.json().catch(() => ({}))) as { url?: string; key?: string; error?: string };
    if (!response.ok || !data.url || !data.key)
      return { ok: false, error: data.error ?? `Upload failed (${response.status})` };
    return { ok: true, url: data.url, key: data.key };
  } catch {
    return { ok: false, error: "Upload failed: network error" };
  }
}

/** "My Photo_final.JPG" → "My Photo final" (used as default alt text). */
export function altFromFilename(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .trim()
      .slice(0, 80) || "image"
  );
}
