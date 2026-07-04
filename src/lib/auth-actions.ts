"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "site_auth";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

// Check the shared team password. On success, set the httpOnly gate cookie that
// the middleware validates. Returns whether it matched (the form shows an error
// on false).
export async function attemptLogin(password: string): Promise<{ ok: boolean }> {
  const expected = process.env.SITE_PASSWORD;
  if (!expected || password !== expected) return { ok: false };
  cookies().set(COOKIE, expected, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS
  });
  return { ok: true };
}

// Clear the gate cookie and bounce to /login (used by the "Lock" button in nav).
export async function logout() {
  cookies().delete(COOKIE);
  redirect("/login");
}
