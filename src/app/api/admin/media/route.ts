import { getAdmin } from "@/modules/auth/guards";
import { getMediaService } from "@/modules/content/container";
import { createRateLimiter, isSameOrigin } from "@/lib/request-guards";

/** 30 uploads per minute per admin. */
const allowUpload = createRateLimiter(30, 60_000);
const MULTIPART_OVERHEAD = 64 * 1024;

/**
 * Image upload (multipart/form-data, field `file`). A route handler rather
 * than a server action because uploads exceed the server-action body limit.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return Response.json({ error: "Cross-origin request rejected" }, { status: 403 });
  const admin = await getAdmin();
  if (!admin) return Response.json({ error: "Not authorized" }, { status: 401 });
  if (!allowUpload(admin.githubId))
    return Response.json({ error: "Too many uploads. Try again in a minute." }, { status: 429 });

  const service = getMediaService();
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > service.maxBytes + MULTIPART_OVERHEAD) {
    return Response.json({ error: "File too large" }, { status: 413 });
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return Response.json({ error: "Expected multipart form data with a `file` field" }, { status: 400 });
  }
  if (!(file instanceof File)) return Response.json({ error: "Missing file" }, { status: 400 });
  if (file.size > service.maxBytes) return Response.json({ error: "File too large" }, { status: 413 });

  const result = await service.upload(new Uint8Array(await file.arrayBuffer()));
  if (!result.ok) return Response.json({ error: result.message }, { status: result.status });
  return Response.json(result.media, { status: 201 });
}
