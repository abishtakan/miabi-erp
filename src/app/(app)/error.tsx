"use client";

import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto mt-12 max-w-2xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Unable to load</p>
      <h1 className="mt-3 text-2xl font-bold text-white">The database did not respond.</h1>
      <p className="mt-3 text-sm leading-6 text-zinc-400">
        Check the database connection and try again. No data was changed by this page load.
      </p>
      <button className="mt-6 min-h-11 bg-white px-5 text-sm font-bold text-black hover:bg-zinc-200" onClick={reset} type="button">
        Try again
      </button>
    </section>
  );
}
