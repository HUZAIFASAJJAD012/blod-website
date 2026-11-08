import { describe, expect, it } from "vitest";
import { hashPassword, passwordProblems, verifyPassword } from "@/lib/auth/password";
import { generateTotpSecret, totpCode, verifyTotp } from "@/lib/auth/totp";
import { decrypt, encrypt, hashIdentifier, safeEqual } from "@/lib/utils/crypto";
import { sniffImageType, validateImage } from "@/server/media/validate";
import { isPrivateAddress } from "@/server/security/safe-fetch";
import { serializeLd } from "@/lib/seo/jsonld";

describe("passwords", () => {
  it("hashes with scrypt and verifies", async () => {
    const h = await hashPassword("correct horse battery staple");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery staple", h)).toBe(true);
    expect(await verifyPassword("wrong password here", h)).toBe(false);
    expect(await verifyPassword("anything", null)).toBe(false);
  });
  it("enforces a length-based policy", () => {
    expect(passwordProblems("short")).toMatch(/12/);
    expect(passwordProblems("aaaaaaaaaaaaaaaa")).toMatch(/repeat/i);
    expect(passwordProblems("a sensible passphrase")).toBeNull();
  });
});

describe("TOTP (RFC 6238)", () => {
  it("matches the RFC test vector for SHA-1", () => {
    // RFC 6238 secret "12345678901234567890" in base32; T=59s → 94287082 (8 digits) → last 6 = 287082
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(totpCode(secret, 59_000)).toBe("287082");
  });
  it("accepts ±1 step and rejects others", () => {
    const s = generateTotpSecret();
    const now = 1_800_000_000_000;
    expect(verifyTotp(s, totpCode(s, now - 30_000), now)).toBe(true);
    expect(verifyTotp(s, totpCode(s, now - 120_000), now)).toBe(false);
    expect(verifyTotp(s, "12345", now)).toBe(false);
  });
});

describe("crypto helpers", () => {
  it("round-trips AES-GCM and detects tampering", () => {
    const c = encrypt("secret-seed");
    expect(decrypt(c)).toBe("secret-seed");
    const parts = c.split(".");
    parts[2] = Buffer.from("tampered").toString("base64url");
    expect(() => decrypt(parts.join("."))).toThrow();
  });
  it("hashes identifiers deterministically and compares safely", () => {
    expect(hashIdentifier("1.2.3.4")).toBe(hashIdentifier("1.2.3.4"));
    expect(hashIdentifier("1.2.3.4")).not.toContain("1.2.3.4");
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

// Minimal valid 1×1 PNG.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

describe("upload validation (MIME spoofing)", () => {
  it("accepts a real PNG", () => {
    const r = validateImage(PNG, "image/png");
    expect(r.ok && r.image.width).toBe(1);
  });
  it("rejects HTML/SVG/script renamed as an image", () => {
    expect(validateImage(Buffer.from("<html><script>alert(1)</script></html>"), "image/png").ok).toBe(false);
    expect(validateImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), "image/svg+xml").ok).toBe(false);
    expect(sniffImageType(Buffer.from("GIF89a"))).toBe("image/gif");
  });
  it("rejects a PNG declared as JPEG (content/type mismatch)", () => {
    expect(validateImage(PNG, "image/jpeg").ok).toBe(false);
  });
  it("rejects empty and oversized files", () => {
    expect(validateImage(Buffer.alloc(0)).ok).toBe(false);
    const big = Buffer.concat([PNG, Buffer.alloc(9 * 1024 * 1024)]);
    expect(validateImage(big).ok).toBe(false);
  });
});

describe("SSRF guard", () => {
  it.each(["127.0.0.1", "10.0.0.5", "172.16.3.4", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])("%s is private", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });
  it.each(["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])("%s is public", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe("JSON-LD serialisation", () => {
  it("cannot break out of the script tag", () => {
    const out = serializeLd({ headline: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out).headline).toBe("</script><script>alert(1)</script>");
  });
});
