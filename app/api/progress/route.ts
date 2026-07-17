import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type D1Result<T> = { results?: T[] };
type D1Statement = { bind(...values: unknown[]): D1Statement; first<T>(): Promise<T|null>; run(): Promise<unknown> };
type D1Database = { prepare(query: string): D1Statement };

async function context(request: NextRequest) {
  const runtime = await import("cloudflare:workers").catch(() => null);
  const db = (runtime?.env as unknown as { DB?: D1Database } | undefined)?.DB;
  if (!db) return null;
  await db.prepare(`CREATE TABLE IF NOT EXISTS user_progress (
    user_id TEXT PRIMARY KEY NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  const email = request.headers.get("oai-authenticated-user-email");
  const userId = email?.trim().toLowerCase() || "local-development";
  return { db, userId };
}

export async function GET(request: NextRequest) {
  const ctx = await context(request);
  if (!ctx) return NextResponse.json({ available: false }, { status: 503 });
  const row = await ctx.db.prepare("SELECT data, updated_at AS updatedAt FROM user_progress WHERE user_id = ?").bind(ctx.userId).first<{data:string;updatedAt:string}>();
  if (!row) return NextResponse.json({ available: true, progress: null });
  return NextResponse.json({ available: true, progress: JSON.parse(row.data), updatedAt: row.updatedAt });
}

export async function PUT(request: NextRequest) {
  const ctx = await context(request);
  if (!ctx) return NextResponse.json({ available: false }, { status: 503 });
  const progress = await request.json().catch(() => null);
  if (!progress || typeof progress !== "object") return NextResponse.json({ error: "invalid_progress" }, { status: 400 });
  const data = JSON.stringify(progress);
  if (data.length > 900_000) return NextResponse.json({ error: "progress_too_large" }, { status: 413 });
  await ctx.db.prepare(`INSERT INTO user_progress (user_id, data, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP`).bind(ctx.userId, data).run();
  return NextResponse.json({ saved: true });
}

export async function DELETE(request: NextRequest) {
  const ctx = await context(request);
  if (!ctx) return NextResponse.json({ available: false }, { status: 503 });
  await ctx.db.prepare("DELETE FROM user_progress WHERE user_id = ?").bind(ctx.userId).run();
  return NextResponse.json({ deleted: true });
}
