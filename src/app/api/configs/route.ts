import { NextRequest, NextResponse } from "next/server";

// Configs library — returns available configs for the launcher
// This is a stub: the launcher expects this endpoint for the configs browser

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, configId, index } = body;

  if (action === "list") {
    // Return empty list for now — configs can be populated later
    return NextResponse.json({ configs: [] });
  }

  if (action === "chunk") {
    return NextResponse.json({ data: "" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
