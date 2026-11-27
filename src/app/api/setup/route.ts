import { NextResponse } from "next/server";
import { setupStatus } from "@/lib/server/config";
import { sharingStatus } from "@/lib/server/sharing";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json({ ...setupStatus(), ...await sharingStatus() }, { headers: { "Cache-Control": "no-store" } }); }
