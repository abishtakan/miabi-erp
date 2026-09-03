import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "miabi_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function secureCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function sign(timestamp: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) return null;
  return createHmac("sha256", secret).update(timestamp).digest("hex");
}

export function authConfigurationError() {
  if (!process.env.APP_PASSWORD) {
    return "APP_PASSWORD is not configured.";
  }

  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
    return "AUTH_SECRET must contain at least 32 characters.";
  }

  return null;
}

export function passwordMatches(value: string) {
  const configuredPassword = process.env.APP_PASSWORD;
  if (!configuredPassword || authConfigurationError()) return false;
  return secureCompare(value, configuredPassword);
}

export async function createSession() {
  const timestamp = Date.now().toString();
  const signature = sign(timestamp);
  if (!signature) throw new Error("Authentication is not configured.");

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `${timestamp}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function isAuthenticated() {
  if (authConfigurationError()) return false;

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;

  const [timestamp, suppliedSignature, ...extra] = token.split(".");
  if (!timestamp || !suppliedSignature || extra.length > 0) return false;

  const issuedAt = Number(timestamp);
  if (
    !Number.isFinite(issuedAt) ||
    issuedAt > Date.now() ||
    Date.now() - issuedAt > SESSION_DURATION_MS
  ) {
    return false;
  }

  const expectedSignature = sign(timestamp);
  return Boolean(
    expectedSignature && secureCompare(suppliedSignature, expectedSignature),
  );
}
