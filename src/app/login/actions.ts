"use server";

import { redirect } from "next/navigation";
import {
  authConfigurationError,
  createSession,
  passwordMatches,
} from "@/lib/auth";

export type LoginState = { message: string };

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const configurationError = authConfigurationError();
  if (configurationError) {
    return { message: configurationError };
  }

  const password = formData.get("password");
  if (typeof password !== "string" || !passwordMatches(password)) {
    return { message: "That password is not correct." };
  }

  await createSession();
  redirect("/");
}
