import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MIABI Boutique Manager",
    template: "%s · MIABI",
  },
  description: "Inventory, sales, and insights for MIABI boutique.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-black text-zinc-100">{children}</body>
    </html>
  );
}
