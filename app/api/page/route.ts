import { NextResponse } from "next/server";
import { userAndToken } from "@/lib/auth";
import { isAllowedPage, notionRequest, pageTitle, readBlocks, ROOT_PAGE_ID } from "@/lib/notion";

export async function GET(request: Request) {
  const { user, token } = await userAndToken();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!token) return NextResponse.json({ error: "Connect Notion first" }, { status: 401 });
  const raw = new URL(request.url).searchParams.get("id") || ROOT_PAGE_ID;
  const id = raw.replace(/-/g, "");
  if (!/^[a-f0-9]{32}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  }
  try {
    if (!(await isAllowedPage(id, token))) {
      return NextResponse.json({ error: "This page is outside the connected workspace" }, { status: 403 });
    }
    const page = await notionRequest("/pages/" + id, token);
    const { blocks, truncated } = await readBlocks(id, token);
    return NextResponse.json(
      { id, title: pageTitle(page), edited: page.last_edited_time, url: page.url, blocks, truncated },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Could not read this Notion page. Check its integration access." }, { status: 502 });
  }
}
