"use server";
import { signIn, signOut, auth } from "@/auth";
import { AuthError } from "next-auth";
import { logAudit } from "@/lib/audit";
import { redirect } from "next/navigation";

export async function ssoSignInAction(provider: "google" | "microsoft-entra-id") {
  await signIn(provider, { redirectTo: "/dashboard" });
}

export async function loginAction({
  loginId,
  password,
  otp,
  callbackUrl,
}: {
  loginId: string;
  password: string;
  otp?: string;
  callbackUrl?: string;
}) {
  try {
    await signIn("credentials", {
      loginId,
      password,
      otp: otp ?? "",
      redirect: false,
    });
    return { redirect: callbackUrl || "/dashboard" };
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: "ログイン失敗。ID/パスワード、または 2FA コードを確認してください" };
    }
    throw e;
  }
}

export async function logoutAction() {
  const session = await auth();
  if (session) {
    await logAudit({ session, action: "auth.logout" });
  }
  await signOut({ redirect: false });
}
