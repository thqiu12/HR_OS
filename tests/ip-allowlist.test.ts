import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ipAllowed, checkRoleAllowlist } from "../lib/ip-allowlist";

describe("ip-allowlist", () => {
  const orig = { ...process.env };
  afterEach(() => { process.env = { ...orig }; });

  it("allows when no allowlist configured for the role (fail-open)", () => {
    delete process.env.IP_ALLOWLIST_GROUP_ADMIN;
    expect(ipAllowed("203.0.113.1", "group_admin")).toBe(true);
  });

  it("matches a single IP", () => {
    process.env.IP_ALLOWLIST_GROUP_ADMIN = "203.0.113.1";
    expect(ipAllowed("203.0.113.1", "group_admin")).toBe(true);
    expect(ipAllowed("203.0.113.2", "group_admin")).toBe(false);
  });

  it("matches a CIDR", () => {
    process.env.IP_ALLOWLIST_ENTITY_HR = "10.0.0.0/8";
    expect(ipAllowed("10.5.5.5", "entity_hr")).toBe(true);
    expect(ipAllowed("11.0.0.1", "entity_hr")).toBe(false);
  });

  it("matches multiple entries", () => {
    process.env.IP_ALLOWLIST_GROUP_ADMIN = "10.0.0.0/8, 192.168.1.0/24";
    expect(ipAllowed("10.5.5.5", "group_admin")).toBe(true);
    expect(ipAllowed("192.168.1.50", "group_admin")).toBe(true);
    expect(ipAllowed("8.8.8.8", "group_admin")).toBe(false);
  });

  it("blocks first failing role across user's roles", () => {
    process.env.IP_ALLOWLIST_GROUP_ADMIN = "10.0.0.0/8";
    delete process.env.IP_ALLOWLIST_EMPLOYEE;
    const roles = [{ role: "employee" }, { role: "group_admin" }];
    expect(checkRoleAllowlist("8.8.8.8", roles)).toBe("group_admin");
    expect(checkRoleAllowlist("10.5.5.5", roles)).toBe(null);
  });

  it("rejects malformed inputs", () => {
    process.env.IP_ALLOWLIST_GROUP_ADMIN = "not-an-ip,10.0.0.0/8";
    expect(ipAllowed("10.5.5.5", "group_admin")).toBe(true);
    expect(ipAllowed("999.999.999.999", "group_admin")).toBe(false);
  });
});
