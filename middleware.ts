import NextAuth from "next-auth";
import authConfig from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic =
    pathname === "/login" ||
    pathname === "/admin-reset" ||
    pathname === "/api/health" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/onboarding/invite") ||
    pathname.startsWith("/portal/teacher");

  // CSRF defense: for state-changing methods, require Origin header to match Host.
  // Server Actions and API routes are both POST; this check stops cross-origin
  // form submissions even if the user is logged in. Webhooks bypass via /api/webhooks.
  const method = req.method;
  if (
    method !== "GET" &&
    method !== "HEAD" &&
    method !== "OPTIONS" &&
    !pathname.startsWith("/api/webhooks") &&
    !pathname.startsWith("/api/cron")
  ) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (origin) {
      try {
        const originHost = new URL(origin).host;
        if (host && originHost !== host) {
          return new Response("Forbidden: cross-origin request blocked", { status: 403 });
        }
      } catch {
        return new Response("Forbidden: invalid origin", { status: 403 });
      }
    }
    // No Origin header on a state-changing request (rare but possible from non-browser clients):
    // require explicit allowlist via API token in the future. For now, allow same-host fetches
    // by checking the Sec-Fetch-Site hint when present.
    const fetchSite = req.headers.get("sec-fetch-site");
    if (!origin && fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
      return new Response("Forbidden: cross-site request blocked", { status: 403 });
    }
  }

  if (!req.auth && !isPublic) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
