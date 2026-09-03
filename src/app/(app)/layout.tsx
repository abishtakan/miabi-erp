import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { isAuthenticated } from "@/lib/auth";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  if (!(await isAuthenticated())) redirect("/login");
  return <AppShell>{children}</AppShell>;
}
