import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/actions";

const navigation = [
  { href: "/", label: "Dashboard", shortLabel: "Overview" },
  { href: "/pos", label: "Point of sale", shortLabel: "POS" },
  { href: "/inventory", label: "Inventory", shortLabel: "Stock" },
  { href: "/stalls", label: "Pop-up stalls", shortLabel: "Stalls" },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black">
      <header className="sticky top-0 z-40 border-b border-zinc-900 bg-black/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="MIABI dashboard">
            <span className="grid size-8 place-items-center border border-zinc-700 text-xs font-black tracking-tighter text-white">
              MI
            </span>
            <span>
              <span className="block text-sm font-black tracking-[0.18em] text-white">MIABI</span>
              <span className="block text-[9px] uppercase tracking-[0.18em] text-zinc-600">
                Boutique manager
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="min-h-11 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-zinc-400 hover:bg-zinc-900 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <form action={logoutAction}>
            <button
              className="min-h-11 border border-zinc-800 px-3 text-xs font-bold uppercase tracking-[0.12em] text-zinc-400 hover:border-zinc-600 hover:text-white"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-7 sm:px-6 sm:pt-10 md:pb-12 lg:px-8">
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-zinc-800 bg-zinc-950 md:hidden"
        aria-label="Mobile navigation"
      >
        {navigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-16 flex-col items-center justify-center gap-1 border-r border-zinc-900 px-2 text-zinc-400 last:border-r-0 hover:bg-zinc-900 hover:text-white"
          >
            <span className="text-[10px] font-black tracking-[0.15em] text-zinc-600">●</span>
            <span className="text-[11px] font-bold uppercase tracking-[0.1em]">
              {item.shortLabel}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
