import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectBinaryMimeSignature,
  groupCreateSchema,
  profileUpdateSchema,
  sanitizeRedirectPath,
  signupSchema,
} from "./schemas";
import {
  formatBytes,
  getInitials,
  sanitizeStorageFileName,
} from "../utils/format";

describe("ASTERIAL v1.1 validation & security helpers", () => {
  it("normalizes and validates usernames and signup inputs", () => {
    const ok = signupSchema.safeParse({
      username: "  Ritam_Das01  ",
      displayName: " Ritam Das ",
      email: "Ritam@Example.com",
      password: "securePassword123!",
    });
    assert.equal(ok.success, true);
    if (ok.success) {
      assert.equal(ok.data.username, "ritam_das01");
      assert.equal(ok.data.displayName, "Ritam Das");
      assert.equal(ok.data.email, "ritam@example.com");
    }

    const bad = signupSchema.safeParse({
      username: "ab",
      displayName: "",
      email: "invalid",
      password: "123",
    });
    assert.equal(bad.success, false);
  });

  it("blocks open-redirect URLs in sanitizeRedirectPath", () => {
    assert.equal(sanitizeRedirectPath("/app/chats/123"), "/app/chats/123");
    assert.equal(sanitizeRedirectPath("https://evil.example/phish"), "/app/chats");
    assert.equal(sanitizeRedirectPath("//evil.example/phish"), "/app/chats");
    assert.equal(sanitizeRedirectPath("/\\evil.example"), "/app/chats");
    assert.equal(sanitizeRedirectPath(null), "/app/chats");
  });

  it("verifies binary magic bytes accurately and rejects disguised executables", () => {
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    assert.equal(detectBinaryMimeSignature(pngBytes), "image/png");

    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    assert.equal(detectBinaryMimeSignature(jpegBytes), "image/jpeg");

    const exeBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
    assert.equal(
      detectBinaryMimeSignature(exeBytes),
      "application/x-executable"
    );
  });

  it("validates group creation and profile update bounds", () => {
    assert.equal(
      groupCreateSchema.safeParse({ name: "   " }).success,
      false
    );
    assert.equal(
      groupCreateSchema.safeParse({ name: "Constellation Core" }).success,
      true
    );
    assert.equal(
      profileUpdateSchema.safeParse({
        username: "xhuracan",
        displayName: "X Huracan",
        bio: "Precision messaging",
        statusText: "In orbit",
      }).success,
      true
    );
  });

  it("sanitizes storage filenames and formats initials/bytes cleanly", () => {
    assert.equal(
      sanitizeStorageFileName("../../etc/passwd;rm -rf.png"),
      "passwd_rm_-rf.png"
    );
    assert.equal(getInitials("Ritam Das"), "RD");
    assert.equal(getInitials("Asterial"), "AS");
    assert.equal(formatBytes(1536), "1.5 KB");
  });
});
