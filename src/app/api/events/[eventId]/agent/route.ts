import { id, key, respond } from "@/lib/server/http";
import { sessions } from "@/lib/server/sessions";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request, context: { params: Promise<{ eventId: string }> }) {
  return respond(request, async () => sessions().query(id((await context.params).eventId), key(request)));
}
