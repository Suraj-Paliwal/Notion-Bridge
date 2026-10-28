import { cookies } from "next/headers";
import { requireChatGPTUser } from "./chatgpt-auth";
import { COOKIE_NAME } from "@/lib/auth";
import BridgeClient from "./BridgeClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  const value = (await cookies()).get(COOKIE_NAME)?.value || "";
  const connected = value.startsWith(encodeURIComponent(user.userId) + ":");
  return <BridgeClient connected={connected} displayName={user.displayName} />;
}
