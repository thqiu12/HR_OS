/**
 * Optional IP allowlist for high-privilege roles.
 *
 * When IP_ALLOWLIST_<ROLE> is set, only requests from listed CIDRs/IPs
 * are accepted for that role. Falls open (allows all) when env unset.
 *
 * Env format (comma-separated CIDR or single IP):
 *   IP_ALLOWLIST_GROUP_ADMIN=10.0.0.0/8,203.0.113.5
 *   IP_ALLOWLIST_ENTITY_HR=10.0.0.0/8
 */

function parseList(env: string | undefined): string[] {
  if (!env) return [];
  return env.split(",").map((s) => s.trim()).filter(Boolean);
}

function ipToInt(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => isNaN(n) || n < 0 || n > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function inCidr(ip: string, cidr: string): boolean {
  if (cidr === ip) return true;
  if (!cidr.includes("/")) return false;
  const [base, prefixStr] = cidr.split("/");
  const prefix = Number(prefixStr);
  const baseInt = ipToInt(base);
  const ipInt = ipToInt(ip);
  if (baseInt === null || ipInt === null || isNaN(prefix)) return false;
  if (prefix === 0) return true;
  const mask = prefix === 32 ? 0xffffffff : (~0 << (32 - prefix)) >>> 0;
  return (baseInt & mask) === (ipInt & mask);
}

export function ipAllowed(ip: string, role: string): boolean {
  const envKey = `IP_ALLOWLIST_${role.toUpperCase()}`;
  const list = parseList(process.env[envKey]);
  if (list.length === 0) return true; // not configured -> allow
  return list.some((entry) => inCidr(ip, entry));
}

/** Returns the first role whose allowlist would block, or null when all pass. */
export function checkRoleAllowlist(ip: string, roles: { role: string }[]): string | null {
  for (const r of roles) {
    if (!ipAllowed(ip, r.role)) return r.role;
  }
  return null;
}
