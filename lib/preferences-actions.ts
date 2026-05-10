"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "./db";

const ALLOWED_KEYS = new Set(["dashboard.kpiOrder"]);

export async function setUserPrefAction(key: string, value: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  if (!ALLOWED_KEYS.has(key)) throw new Error(`Unknown pref: ${key}`);
  if (value.length > 4096) throw new Error("Value too large");
  db.setUserPref(session.user.id, key, value);
  revalidatePath("/dashboard");
  return { ok: true as const };
}
