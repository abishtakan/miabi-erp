import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { authConfigurationError, isAuthenticated } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await isAuthenticated()) redirect("/");
  const configurationError = authConfigurationError();

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <section className="w-full max-w-md border border-zinc-800 bg-zinc-950 p-6 sm:p-9">
        <span className="grid size-12 place-items-center border border-zinc-600 text-sm font-black tracking-tighter text-white">
          MI
        </span>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">
          Private team workspace
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-white">
          Welcome to MIABI
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Sign in to manage boutique stock, record sales, and review performance.
        </p>
        <LoginForm configurationError={configurationError} />
      </section>
    </main>
  );
}
