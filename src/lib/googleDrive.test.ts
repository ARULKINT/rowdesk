import { describe, expect, it } from "vitest";
import { classifyDriveFile, extractFolderId, isGoogleDriveConfigured } from "./googleDrive";

describe("extractFolderId", () => {
  it("accepts a bare folder ID", () => {
    expect(extractFolderId("1a2B3c4D5e")).toBe("1a2B3c4D5e");
  });

  it("extracts the ID from a folder URL", () => {
    expect(
      extractFolderId("https://drive.google.com/drive/folders/1a2B3c4D5e?usp=sharing")
    ).toBe("1a2B3c4D5e");
  });

  it("extracts the ID from an ?id= style URL", () => {
    expect(extractFolderId("https://drive.google.com/open?id=1a2B3c4D5e")).toBe("1a2B3c4D5e");
  });

  it("trims whitespace around a bare ID", () => {
    expect(extractFolderId("  1a2B3c4D5e  ")).toBe("1a2B3c4D5e");
  });
});

describe("classifyDriveFile", () => {
  const t1 = new Date("2026-09-01T00:00:00Z");
  const t2 = new Date("2026-09-02T00:00:00Z");

  it("classifies a never-seen-before file as new", () => {
    expect(classifyDriveFile(null, t1)).toBe("new");
  });

  it("classifies a file that's never been successfully processed as new", () => {
    expect(classifyDriveFile({ status: "new", lastProcessedVersion: null }, t1)).toBe("new");
    expect(classifyDriveFile({ status: "error", lastProcessedVersion: null }, t1)).toBe("new");
  });

  it("classifies a file whose modifiedTime moved past what we processed as updated", () => {
    expect(classifyDriveFile({ status: "processed", lastProcessedVersion: t1 }, t2)).toBe(
      "updated"
    );
  });

  it("classifies a file whose modifiedTime matches what we processed as unchanged", () => {
    expect(classifyDriveFile({ status: "processed", lastProcessedVersion: t1 }, t1)).toBe(
      "unchanged"
    );
  });

  it("leaves a file mid-import alone instead of reclassifying it", () => {
    expect(classifyDriveFile({ status: "processing", lastProcessedVersion: null }, t1)).toBeNull();
  });
});

describe("isGoogleDriveConfigured", () => {
  it("is false when the OAuth env vars are unset", () => {
    const prev = {
      id: process.env.GOOGLE_CLIENT_ID,
      secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect: process.env.GOOGLE_REDIRECT_URI,
    };
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;

    expect(isGoogleDriveConfigured()).toBe(false);

    if (prev.id) process.env.GOOGLE_CLIENT_ID = prev.id;
    if (prev.secret) process.env.GOOGLE_CLIENT_SECRET = prev.secret;
    if (prev.redirect) process.env.GOOGLE_REDIRECT_URI = prev.redirect;
  });

  it("is true once all three OAuth env vars are set", () => {
    process.env.GOOGLE_CLIENT_ID = "test-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-secret";
    process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/admin/drive/callback";

    expect(isGoogleDriveConfigured()).toBe(true);

    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
  });
});
