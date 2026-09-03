import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-zinc-800 pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">
          {eyebrow}
        </p>
        <h1 className="text-3xl font-bold tracking-[-0.04em] text-white sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          {description}
        </p>
      </div>
      {action}
    </header>
  );
}

export function Badge({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={`inline-flex min-h-6 items-center border px-2 text-[11px] font-bold uppercase tracking-[0.12em] ${
        muted
          ? "border-zinc-800 bg-zinc-950 text-zinc-500"
          : "border-zinc-700 bg-zinc-900 text-zinc-200"
      }`}
    >
      {children}
    </span>
  );
}

export function DatabaseSetup() {
  return (
    <section className="mx-auto mt-12 max-w-2xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
        Setup required
      </p>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">
        Connect the Railway database
      </h1>
      <p className="mt-3 text-sm leading-6 text-zinc-400">
        Add <code className="text-zinc-200">DATABASE_URL</code> to your local
        environment, run the database migration, then reload this page. The exact
        commands are in the project README.
      </p>
    </section>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border border-dashed border-zinc-800 px-6 py-12 text-center">
      <p className="font-bold text-zinc-200">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
        {children}
      </p>
    </div>
  );
}
