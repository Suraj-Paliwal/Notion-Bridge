export const ROOT_PAGE_ID = "3ea194a1c5628144b065cd9827f4173e";
const VERSION = "2026-03-11";
const API = "https://api.notion.com/v1";

export type MirrorBlock = {
  id: string;
  type: string;
  text: string;
  edited: string;
  children?: MirrorBlock[];
};

export async function notionRequest(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(API + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + token,
      "Notion-Version": VERSION,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data.message === "string" ? data.message : "Notion request failed";
    throw new Error(message);
  }
  return data;
}

export function pageTitle(page: any): string {
  const properties = page?.properties || {};
  for (const value of Object.values(properties) as any[]) {
    if (value?.type === "title") {
      return (value.title || []).map((part: any) => part.plain_text || part.text?.content || "").join("");
    }
  }
  return "Notion page";
}

export async function isAllowedPage(id: string, token: string): Promise<boolean> {
  if (id === ROOT_PAGE_ID) return true;
  let current = id;
  for (let i = 0; i < 8; i++) {
    const block = await notionRequest("/blocks/" + encodeURIComponent(current), token);
    const parent = block?.parent;
    const parentId = parent?.page_id || parent?.block_id;
    if (!parentId) return false;
    if (parentId.replace(/-/g, "") === ROOT_PAGE_ID) return true;
    current = parentId;
  }
  return false;
}

function blockText(block: any): string {
  const body = block?.[block.type] || {};
  if (block.type === "child_page") return body.title || "Untitled page";
  if (block.type === "child_database") return body.title || "Database";
  if (block.type === "image") return body.caption?.map((part: any) => part.plain_text || "").join("") || "Image";
  if (block.type === "divider") return "";
  if (block.type === "table_row") {
    return (body.cells || []).map((cell: any[]) => cell.map((part: any) => part.plain_text || part.text?.content || "").join("")).join(" | ");
  }
  return (body.rich_text || []).map((part: any) => part.plain_text || part.text?.content || "").join("");
}

export async function readBlocks(pageId: string, token: string): Promise<{ blocks: MirrorBlock[]; truncated: boolean }> {
  let requestCount = 0;
  let itemCount = 0;
  let truncated = false;
  async function childrenOf(parentId: string, depth: number): Promise<MirrorBlock[]> {
    const result: MirrorBlock[] = [];
    let cursor: string | undefined;
    do {
      if (requestCount >= 24 || itemCount >= 500) { truncated = true; break; }
      requestCount++;
      const query = new URLSearchParams({ page_size: "100" });
      if (cursor) query.set("start_cursor", cursor);
      const data = await notionRequest("/blocks/" + encodeURIComponent(parentId) + "/children?" + query, token);
      for (const block of data.results || []) {
        itemCount++;
        const entry: MirrorBlock = {
          id: block.id,
          type: block.type,
          text: blockText(block),
          edited: block.last_edited_time || "",
        };
        if (block.has_children && block.type !== "child_page" && block.type !== "child_database" && depth < 2 && requestCount < 24) {
          entry.children = await childrenOf(block.id, depth + 1);
        }
        result.push(entry);
        if (itemCount >= 500) { truncated = true; break; }
      }
      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);
    return result;
  }
  return { blocks: await childrenOf(pageId, 0), truncated };
}

export async function appendJapanese(pageId: string, token: string, text: string) {
  const chunks = text.match(/[\s\S]{1,1800}/g) || [];
  if (chunks.length > 10) throw new Error("Message is too long");
  return notionRequest("/blocks/" + encodeURIComponent(pageId) + "/children", token, {
    method: "PATCH",
    body: JSON.stringify({
      children: chunks.map((chunk) => ({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content: chunk } }] },
      })),
    }),
  });
}
