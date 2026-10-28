import { cookies } from "next/headers";
import { getChatGPTUser } from "@/app/chatgpt-auth";

export const COOKIE_NAME = "notion_bridge_token";

export async function userAndToken() {
  const user = await getChatGPTUser();
  if (!user) return { user: null, token: null };
  const value = (await cookies()).get(COOKIE_NAME)?.value || "";
  const prefix = encodeURIComponent(user.userId) + ":";
  const token = value.startsWith(prefix) ? value.slice(prefix.length) : null;
  return { user, token };
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
}
