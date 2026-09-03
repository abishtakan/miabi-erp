"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { message: "" };

export function LoginForm({ configurationError }: { configurationError: string | null }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const message = state.message || configurationError;

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-zinc-400" htmlFor="password">
          Team password
        </label>
        <input
          autoComplete="current-password"
          autoFocus
          className="min-h-12 w-full border border-zinc-700 bg-black px-4 text-base text-white placeholder:text-zinc-700 focus:border-white focus:outline-none disabled:opacity-50"
          disabled={Boolean(configurationError) || pending}
          id="password"
          name="password"
          placeholder="Enter password"
          required
          type="password"
        />
      </div>

      {message ? (
        <p className="border-l-2 border-zinc-500 pl-3 text-sm leading-6 text-zinc-300" aria-live="polite">
          {message}
        </p>
      ) : null}

      <button
        className="min-h-12 w-full bg-white px-5 text-sm font-black uppercase tracking-[0.12em] text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        disabled={Boolean(configurationError) || pending}
        type="submit"
      >
        {pending ? "Signing in…" : "Enter MIABI"}
      </button>
    </form>
  );
}
