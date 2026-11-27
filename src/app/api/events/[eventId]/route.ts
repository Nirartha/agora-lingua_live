import { id, respond } from "@/lib/server/http";
import { sessions } from "@/lib/server/sessions";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ eventId: string }> }) {
  return respond(request, async () => ({ session: await sessions().get(id((await context.params).eventId)) }));
}
