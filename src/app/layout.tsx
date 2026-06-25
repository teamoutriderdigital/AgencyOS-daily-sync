import type { Metadata } from "next";
import "./globals.css";
import { SiteNav } from "@/components/site-nav";

export const metadata: Metadata = {
  title: "Daily Sync Board",
  description: "Internal daily standup — check-in, headlines, IDS, and to-dos."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-display antialiased">
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
