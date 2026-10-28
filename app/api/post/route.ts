import { NextResponse } from "next/server";
import { sameOrigin, userAndToken } from "@/lib/auth";
import { appendJapanese, isAllowedPage } from "@/lib/notion";

export async function POST(request: Request) {
  const { user, token } = await userAndToken();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!token) return NextResponse.json({ error: "Connect Notion first" }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const body: any = await request.json().catch(() => ({}));
  const pageId = typeof body.pageId === "string" ? body.pageId.replace(/-/g, "") : "";
  const japanese = typeof body.japanese === "string" ? body.japanese.trim() : "";
  if (!/^[a-f0-9]{32}$/i.test(pageId) || !japanese || japanese.length > 5000 || body.confirmed !== true) {
    return NextResponse.json({ error: "Review and confirm a valid Japanese draft" }, { status: 400 });
  }
  try {
    if (!(await isAllowedPage(pageId, token))) {
      return NextResponse.json({ error: "Page is outside the connected workspace" }, { status: 403 });
    }
    const result = await appendJapanese(pageId, token, japanese);
    return NextResponse.json(
      { posted: true, blockIds: (result.results || []).map((block: any) => block.id) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Posting failed. Check Notion edit permission before trying again." }, { status: 502 });
  }
}
