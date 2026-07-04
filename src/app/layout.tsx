import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SiteNav } from "@/components/site-nav";

// Inter backs the `font-display` utility via a CSS variable (see tailwind.config).
const inter = Inter({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "Daily Sync Board",
  description: "Internal daily standup — check-in, headlines, IDS, and to-dos."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-display antialiased">
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
