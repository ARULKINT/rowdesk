import "server-only";
import { google, drive_v3 } from "googleapis";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/encryption";

const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

export function isGoogleDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI
  );
}

function createOAuthClient() {
  if (!isGoogleDriveConfigured()) {
    throw new Error(
      "Google Drive isn't configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI."
    );
  }
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function generateAuthUrl(state: string): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // ensures a refresh_token is returned even on repeat connects
    scope: SCOPES,
    state,
  });
}

export async function connectWithCode(code: string, connectedByUserId: string) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error(
      "Google didn't return a refresh token. Revoke Rowdesk's access at myaccount.google.com/permissions and reconnect."
    );
  }
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ auth: client, version: "v2" });
  const { data: profile } = await oauth2.userinfo.get();
  if (!profile.email) throw new Error("Couldn't read the connected Google account's email.");

  const record = {
    connectedByUserId,
    googleEmail: profile.email,
    accessToken: encrypt(tokens.access_token),
    refreshToken: encrypt(tokens.refresh_token),
    tokenExpiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
  };

  await prisma.googleDriveConnection.upsert({
    where: { singleton: true },
    create: { singleton: true, ...record },
    update: record,
  });
}

export async function disconnectDrive(): Promise<void> {
  await prisma.googleDriveConnection.deleteMany({});
}

export async function getConnection() {
  return prisma.googleDriveConnection.findUnique({ where: { singleton: true } });
}

/** Returns an authorized Drive client, refreshing + persisting the access
 * token if it has expired. Throws if there's no active connection. */
export async function getAuthorizedDriveClient(): Promise<drive_v3.Drive> {
  const connection = await getConnection();
  if (!connection) throw new Error("Google Drive isn't connected.");

  const client = createOAuthClient();
  client.setCredentials({
    access_token: decrypt(connection.accessToken),
    refresh_token: decrypt(connection.refreshToken),
    expiry_date: connection.tokenExpiresAt.getTime(),
  });

  client.on("tokens", (tokens) => {
    if (!tokens.access_token) return;
    prisma.googleDriveConnection
      .update({
        where: { singleton: true },
        data: {
          accessToken: encrypt(tokens.access_token),
          tokenExpiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
        },
      })
      .catch(() => {});
  });

  return google.drive({ version: "v3", auth: client });
}

/** Accepts a bare folder ID or a full Drive folder URL. */
export function extractFolderId(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch) return idParamMatch[1];
  return trimmed;
}

export async function verifyFolder(drive: drive_v3.Drive, folderId: string) {
  const { data } = await drive.files.get({
    fileId: folderId,
    fields: "id,name,mimeType",
  });
  if (data.mimeType !== "application/vnd.google-apps.folder") {
    throw new Error("That ID doesn't point to a Google Drive folder.");
  }
  return { id: data.id!, name: data.name ?? "(untitled folder)" };
}

export interface DriveCsvFile {
  id: string;
  name: string;
  modifiedTime: string;
}

export async function listCsvFilesInFolder(
  drive: drive_v3.Drive,
  folderId: string
): Promise<DriveCsvFile[]> {
  const files: DriveCsvFile[] = [];
  let pageToken: string | undefined;

  do {
    const { data } = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and (mimeType = 'text/csv' or name contains '.csv')`,
      fields: "nextPageToken, files(id, name, modifiedTime)",
      pageToken,
      pageSize: 200,
    });
    for (const f of data.files ?? []) {
      if (f.id && f.name && f.modifiedTime) {
        files.push({ id: f.id, name: f.name, modifiedTime: f.modifiedTime });
      }
    }
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}

export type DriveFileStatus =
  | "new"
  | "updated"
  | "unchanged"
  | "processing"
  | "processed"
  | "error";

/**
 * Classifies a scanned Drive file against what we already know about it, by
 * comparing Drive's modifiedTime to the version we last successfully
 * processed. A file mid-processing is left alone so a scan can't yank the
 * status out from under an in-flight import.
 */
export function classifyDriveFile(
  existing: { status: DriveFileStatus; lastProcessedVersion: Date | null } | null,
  modifiedTime: Date
): DriveFileStatus | null {
  if (!existing) return "new";
  if (existing.status === "processing") return null; // leave as-is
  if (!existing.lastProcessedVersion) return "new";
  return existing.lastProcessedVersion.getTime() !== modifiedTime.getTime()
    ? "updated"
    : "unchanged";
}

export async function downloadFileText(drive: drive_v3.Drive, fileId: string): Promise<string> {
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "text" }
  );
  return res.data as unknown as string;
}
