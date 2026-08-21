import { describe, it, expect } from "vitest";
import { isSafeRedirectPath } from "./safe-redirect";

const origin = "https://example.com";

describe("isSafeRedirectPath", () => {
  it("accepts a normal relative path", () => {
    expect(isSafeRedirectPath("/conta", origin)).toBe(true);
  });

  it("accepts a relative path with a subpath and query string", () => {
    expect(isSafeRedirectPath("/conta/pedidos?x=1", origin)).toBe(true);
  });

  it("rejects null, undefined and empty string", () => {
    expect(isSafeRedirectPath(null, origin)).toBe(false);
    expect(isSafeRedirectPath(undefined, origin)).toBe(false);
    expect(isSafeRedirectPath("", origin)).toBe(false);
  });

  it("rejects an absolute external URL", () => {
    expect(isSafeRedirectPath("https://evil.com", origin)).toBe(false);
  });

  it("rejects a protocol-relative URL (the bug this fixes)", () => {
    // "//evil.com".startsWith("/") is true, which is exactly why the old
    // guard (`callbackUrl.startsWith("/")`) was bypassable: the browser
    // resolves "//evil.com" as protocol-relative and navigates off-site.
    expect(isSafeRedirectPath("//evil.com", origin)).toBe(false);
    expect(isSafeRedirectPath("//evil.com/phish", origin)).toBe(false);
  });

  it("rejects a javascript: URL", () => {
    expect(isSafeRedirectPath("javascript:alert(1)", origin)).toBe(false);
  });

  it("accepts an absolute URL on the same origin", () => {
    expect(isSafeRedirectPath("https://example.com/foo", origin)).toBe(true);
  });

  it("rejects backslash variants", () => {
    // Verified with Node's URL parser: browsers (and Node/WHATWG URL) treat
    // backslashes like forward slashes in these positions, so both variants
    // resolve to https://evil.com/ — a different origin from `origin`, so
    // they are correctly rejected as unsafe. `/\evil.com` -> "https://evil.com/",
    // `\\evil.com` -> "https://evil.com/".
    expect(isSafeRedirectPath("/\\evil.com", origin)).toBe(false);
    expect(isSafeRedirectPath("\\\\evil.com", origin)).toBe(false);
  });
});
