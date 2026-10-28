import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { COOKIE_NAME, sameOrigin } from "@/lib/auth";
import { notionRequest, ROOT_PAGE_ID } from "@/lib/notion";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const body: any = await request.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (token.length < 20 || token.length > 500) {
    return NextResponse.json({ error: "Enter a valid Notion integration token" }, { status: 400 });
  }
  try {
    await notionRequest("/pages/" + ROOT_PAGE_ID, token);
    (await cookies()).set(COOKIE_NAME, encodeURIComponent(user.userId) + ":" + token, {
      httpOnly: true,
      secure: new URL(request.url).protocol === "https:",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return NextResponse.json({ connected: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: "The token could not open the shared page. Add the integration to the page and try again." },
      { status: 403 },
    );
  }
}

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  (await cookies()).delete(COOKIE_NAME);
  return NextResponse.json({ connected: false }, { headers: { "Cache-Control": "private, no-store" } });
}
