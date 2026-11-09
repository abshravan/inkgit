import { getRedirectMap } from "@/modules/content/queries";

/**
 * Old slug → new slug map used by `proxy.ts` to answer renamed URLs with a
 * real HTTP 308. Built from cached content, so it's static between publishes.
 */
export async function GET(): Promise<Response> {
  return Response.json(await getRedirectMap());
}
