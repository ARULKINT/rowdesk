export type MappedField = "name" | "phone" | "rating" | "mapsUrl" | "websiteUrl";

const FIELD_ALIASES: Record<MappedField, string[]> = {
  name: ["name", "businessname", "company", "companyname", "business"],
  phone: ["phone", "phonenumber", "contact", "contactnumber", "mobile", "mobilenumber"],
  rating: ["rating", "avgrating", "averagerating", "stars", "reviewrating"],
  mapsUrl: [
    "mapsurl",
    "mapurl",
    "googlemapsurl",
    "gmap",
    "gmaps",
    "mapslink",
    "maplink",
    "googlemaps",
    "location",
    "locationurl",
  ],
  websiteUrl: ["websiteurl", "website", "weburl", "site", "url", "web"],
};

const REQUIRED_FIELDS: MappedField[] = ["name", "phone"];

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export interface ColumnMappingResult {
  mapping: Partial<Record<MappedField, string>>;
  missingRequired: MappedField[];
}

export function mapColumns(headers: string[]): ColumnMappingResult {
  const normalizedToOriginal = new Map<string, string>();
  for (const h of headers) {
    normalizedToOriginal.set(normalizeHeader(h), h);
  }

  const mapping: Partial<Record<MappedField, string>> = {};

  for (const field of Object.keys(FIELD_ALIASES) as MappedField[]) {
    for (const alias of FIELD_ALIASES[field]) {
      const original = normalizedToOriginal.get(alias);
      if (original) {
        mapping[field] = original;
        break;
      }
    }
  }

  const missingRequired = REQUIRED_FIELDS.filter((f) => !mapping[f]);

  return { mapping, missingRequired };
}

export interface ParsedRecordRow {
  name: string;
  phone: string | null;
  rating: number | null;
  mapsUrl: string | null;
  websiteUrl: string | null;
}

export type RowRejectionReason = "missing_name" | "missing_phone";

/**
 * Cleans a scraped phone number down to a canonical 10-digit Indian mobile
 * number, or returns null if the row should be dropped entirely.
 *
 *  - Strips all non-digit formatting (spaces, dashes, parens).
 *  - Drops a leading "91" country code (12 digits total -> 10).
 *  - Drops a leading trunk "0" only when there are 11 digits total, i.e.
 *    0 + a clean 10-digit number (e.g. "086809 48502" -> "8680948502").
 *  - Anything left that isn't a 10-digit number starting 6-9 is rejected
 *    (returns null) rather than guessed at or partially cleaned:
 *      - a leading-0 number that was already only 10 digits — the real
 *        last digit was lost upstream, before the CSV even reached us, and
 *        can't be recovered by stripping the 0 (that just leaves 9 digits);
 *      - a landline/STD-code number (starts 0-5, not a mobile prefix) —
 *        useless for SMS/WhatsApp outreach anyway;
 *      - garbage-length scrape noise (too short or too long).
 */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export type RowToRecordResult =
  | { ok: true; record: ParsedRecordRow }
  | { ok: false; reason: RowRejectionReason };

/**
 * Rows missing Name or Phone are removed from the processing dataset entirely
 * (per the cleaning rules — every surviving record must be callable by name).
 * Rating / Maps URL / Website are preserved even when blank; missing values
 * there are reported as data-quality stats instead of causing removal.
 */
export function rowToRecord(
  row: Record<string, string>,
  mapping: Partial<Record<MappedField, string>>
): RowToRecordResult {
  const nameCol = mapping.name;
  const name = nameCol ? row[nameCol]?.trim() : "";
  if (!name) return { ok: false, reason: "missing_name" };

  const phoneCol = mapping.phone;
  const phoneRaw = phoneCol ? row[phoneCol]?.trim() : "";
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (!phone) return { ok: false, reason: "missing_phone" };

  const ratingCol = mapping.rating;
  const ratingRaw = ratingCol ? row[ratingCol]?.trim() : "";
  const ratingParsed = ratingRaw ? parseFloat(ratingRaw) : NaN;
  const rating = Number.isFinite(ratingParsed) ? ratingParsed : null;

  const mapsCol = mapping.mapsUrl;
  const mapsUrl = mapsCol ? row[mapsCol]?.trim() || null : null;

  const websiteCol = mapping.websiteUrl;
  const websiteUrl = websiteCol ? row[websiteCol]?.trim() || null : null;

  return { ok: true, record: { name, phone, rating, mapsUrl, websiteUrl } };
}

export function extractDomain(websiteUrl: string | null): string {
  if (!websiteUrl) return "";
  return websiteUrl
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "");
}
