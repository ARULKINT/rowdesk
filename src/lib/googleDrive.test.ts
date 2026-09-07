import { describe, expect, it } from "vitest";
import {
  classifyDriveFile,
  extractFolderId,
  getConfiguredFolderId,
  isGoogleDriveConfigured,
  listCsvFilesInFolder,
} from "./googleDrive";
import type { drive_v3 } from "googleapis";

interface FakeFolder {
  id: string;
  csvFiles: { id: string; name: string; modifiedTime: string }[];
  subfolders: { id: string; name: string }[];
}

/** A minimal fake of the Drive client's `files.list`, keyed by parent
 * folder id, enough to exercise listCsvFilesInFolder's traversal. */
function fakeDrive(folders: Record<string, FakeFolder>): drive_v3.Drive {
  return {
    files: {
      list: async ({ q }: { q?: string }) => {
        const parentMatch = q?.match(/'([^']+)' in parents/);
        const parentId = parentMatch?.[1];
        const folder = parentId ? folders[parentId] : undefined;
        const isFolderQuery = q?.includes("application/vnd.google-apps.folder");

        if (!folder) return { data: { files: [] } };
        return {
          data: { files: isFolderQuery ? folder.subfolders : folder.csvFiles },
        };
      },
    },
  } as unknown as drive_v3.Drive;
}

describe("listCsvFilesInFolder", () => {
  it("collects CSVs from the root folder alone", async () => {
    const drive = fakeDrive({
      root: {
        id: "root",
        csvFiles: [{ id: "f1", name: "a.csv", modifiedTime: "2026-01-01T00:00:00Z" }],
        subfolders: [],
      },
    });

    const files = await listCsvFilesInFolder(drive, "root");
    expect(files.map((f) => f.name)).toEqual(["a.csv"]);
  });

  it("recurses into subfolders and collects CSVs from every level", async () => {
    const drive = fakeDrive({
      root: {
        id: "root",
        csvFiles: [{ id: "f1", name: "a.csv", modifiedTime: "2026-01-01T00:00:00Z" }],
        subfolders: [{ id: "sub1", name: "Sub 1" }],
      },
      sub1: {
        id: "sub1",
        csvFiles: [{ id: "f2", name: "b.csv", modifiedTime: "2026-01-02T00:00:00Z" }],
        subfolders: [{ id: "sub2", name: "Sub 2" }],
      },
      sub2: {
        id: "sub2",
        csvFiles: [{ id: "f3", name: "c.csv", modifiedTime: "2026-01-03T00:00:00Z" }],
        subfolders: [],
      },
    });

    const files = await listCsvFilesInFolder(drive, "root");
    expect(files.map((f) => f.name).sort()).toEqual(["a.csv", "b.csv", "c.csv"]);
  });

  it("doesn't revisit a folder it's already processed", async () => {
    let sub1Calls = 0;
    const drive = {
      files: {
        list: async ({ q }: { q?: string }) => {
          const parentMatch = q?.match(/'([^']+)' in parents/);
          const parentId = parentMatch?.[1];
          const isFolderQuery = q?.includes("application/vnd.google-apps.folder");

          if (parentId === "sub1" && !isFolderQuery) sub1Calls += 1;

          if (parentId === "root") {
            return {
              data: {
                files: isFolderQuery
                  ? [
                      { id: "sub1", name: "Sub 1" },
                      { id: "sub1", name: "Sub 1 (duplicate parent link)" },
                    ]
                  : [],
              },
            };
          }
          if (parentId === "sub1") {
            return { data: { files: isFolderQuery ? [] : [{ id: "f1", name: "a.csv", modifiedTime: "2026-01-01T00:00:00Z" }] } };
          }
          return { data: { files: [] } };
        },
      },
    } as unknown as drive_v3.Drive;

    const files = await listCsvFilesInFolder(drive, "root");
    expect(files).toHaveLength(1);
    expect(sub1Calls).toBe(1);
  });
});

describe("getConfiguredFolderId", () => {
  it("returns null when unset", () => {
    delete process.env.GOOGLE_DRIVE_FOLDER_ID;
    expect(getConfiguredFolderId()).toBeNull();
  });

  it("extracts the folder ID whether given a bare ID or a full URL", () => {
    process.env.GOOGLE_DRIVE_FOLDER_ID = "https://drive.google.com/drive/folders/abc123?usp=sharing";
    expect(getConfiguredFolderId()).toBe("abc123");

    process.env.GOOGLE_DRIVE_FOLDER_ID = "abc123";
    expect(getConfiguredFolderId()).toBe("abc123");

    delete process.env.GOOGLE_DRIVE_FOLDER_ID;
  });
});

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
