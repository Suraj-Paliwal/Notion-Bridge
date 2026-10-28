import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bridge | Notion in English",
  description: "A private English view and Japanese writing bridge for a shared Notion page.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
