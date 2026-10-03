import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "MALTown RiDE — Malamulele's local ride network",
  description:
    "MALTown RiDE is a modern African mobility platform: request a ride, track it live, and move with confidence.",
};

export const viewport: Viewport = {
  themeColor: "#05070D",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-night-950 font-body text-slate-200 antialiased">{children}</body>
    </html>
  );
}
