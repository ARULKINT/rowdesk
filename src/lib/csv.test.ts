import { describe, expect, it } from "vitest";
import { extractDomain, mapColumns, normalizePhone, rowToRecord } from "./csv";

describe("mapColumns", () => {
  it("maps exact expected headers", () => {
    const { mapping, missingRequired } = mapColumns([
      "name",
      "phone",
      "rating",
      "maps_url",
      "website_url",
    ]);
    expect(mapping.name).toBe("name");
    expect(mapping.phone).toBe("phone");
    expect(mapping.rating).toBe("rating");
    expect(mapping.mapsUrl).toBe("maps_url");
    expect(mapping.websiteUrl).toBe("website_url");
    expect(missingRequired).toEqual([]);
  });

  it("detects differently-named / oddly-cased columns", () => {
    const { mapping, missingRequired } = mapColumns([
      "Business Name",
      "Phone Number",
      "Average Rating",
      "Google Maps URL",
      "Website URL",
    ]);
    expect(mapping.name).toBe("Business Name");
    expect(mapping.phone).toBe("Phone Number");
    expect(mapping.rating).toBe("Average Rating");
    expect(mapping.mapsUrl).toBe("Google Maps URL");
    expect(mapping.websiteUrl).toBe("Website URL");
    expect(missingRequired).toEqual([]);
  });

  it("reports missing required columns clearly", () => {
    const { mapping, missingRequired } = mapColumns(["rating", "website"]);
    expect(mapping.name).toBeUndefined();
    expect(mapping.phone).toBeUndefined();
    expect(missingRequired).toEqual(["name", "phone"]);
  });

  it("treats optional columns as absent without erroring", () => {
    const { mapping, missingRequired } = mapColumns(["name", "phone"]);
    expect(mapping.rating).toBeUndefined();
    expect(mapping.mapsUrl).toBeUndefined();
    expect(mapping.websiteUrl).toBeUndefined();
    expect(missingRequired).toEqual([]);
  });
});

describe("rowToRecord", () => {
  const mapping = mapColumns([
    "name",
    "phone",
    "rating",
    "maps_url",
    "website_url",
  ]).mapping;

  it("trims whitespace from name and normalizes the phone number", () => {
    const result = rowToRecord(
      {
        name: "  ABC Motors  ",
        phone: "  +91 98765 43210  ",
        rating: "4.5",
        maps_url: "https://maps.google.com/?q=abc",
        website_url: "https://abcmotors.com",
      },
      mapping
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.name).toBe("ABC Motors");
      expect(result.record.phone).toBe("9876543210");
    }
  });

  it("removes the record when name is missing", () => {
    const result = rowToRecord(
      { name: "   ", phone: "12345", rating: "", maps_url: "", website_url: "" },
      mapping
    );
    expect(result).toEqual({ ok: false, reason: "missing_name" });
  });

  it("removes the record when phone is missing", () => {
    const result = rowToRecord(
      { name: "ABC Motors", phone: "  ", rating: "", maps_url: "", website_url: "" },
      mapping
    );
    expect(result).toEqual({ ok: false, reason: "missing_phone" });
  });

  it("removes the record when phone doesn't clean up into a valid mobile number", () => {
    const result = rowToRecord(
      { name: "ABC Motors", phone: "12345", rating: "", maps_url: "", website_url: "" },
      mapping
    );
    expect(result).toEqual({ ok: false, reason: "missing_phone" });
  });

  it("keeps the record when rating, maps_url or website_url are blank", () => {
    const result = rowToRecord(
      { name: "ABC Motors", phone: "9876543210", rating: "", maps_url: "", website_url: "" },
      mapping
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.rating).toBeNull();
      expect(result.record.mapsUrl).toBeNull();
      expect(result.record.websiteUrl).toBeNull();
    }
  });

  it("parses a valid rating and ignores an unparseable one", () => {
    const good = rowToRecord(
      { name: "A", phone: "9876543210", rating: "4.2", maps_url: "", website_url: "" },
      mapping
    );
    const bad = rowToRecord(
      { name: "A", phone: "9876543210", rating: "n/a", maps_url: "", website_url: "" },
      mapping
    );
    expect(good.ok && good.record.rating).toBe(4.2);
    expect(bad.ok && bad.record.rating).toBeNull();
  });
});

describe("normalizePhone", () => {
  it("strips a leading trunk 0 when there are 11 digits total, plus the space", () => {
    expect(normalizePhone("086809 48502")).toBe("8680948502");
  });

  it("leaves an already-clean 10-digit mobile number unchanged", () => {
    expect(normalizePhone("8680948502")).toBe("8680948502");
  });

  it("strips a +91 country code and formatting", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("9876543210");
    expect(normalizePhone("91-98765-43210")).toBe("9876543210");
  });

  it("strips dashes and parens", () => {
    expect(normalizePhone("(868) 094-8502")).toBe("8680948502");
  });

  it("rejects a leading-0 number that was already only 10 digits", () => {
    // Real production examples: the business's OTHER listing has the intact
    // 10-digit number ("9751255539"), but this listing lost its real last
    // digit upstream (before the CSV ever reached us) and got a fake
    // leading 0 stuck on to disguise it. Stripping the 0 would only leave a
    // 9-digit number — still wrong — so the row is rejected instead.
    expect(normalizePhone("0975125553")).toBeNull();
    expect(normalizePhone("0967762420")).toBeNull();
    expect(normalizePhone("0744833999")).toBeNull();
  });

  it("rejects a landline / STD-code number (doesn't start 6-9)", () => {
    // Real production example: Ramana Communication, "4132224389" — a
    // Puducherry STD-code-based landline. Not reachable by SMS/WhatsApp
    // outreach, so it's dropped rather than kept as a dead lead.
    expect(normalizePhone("4132224389")).toBeNull();
  });

  it("rejects garbage-length scrape noise", () => {
    expect(normalizePhone("360850850977")).toBeNull(); // 13 digits
    expect(normalizePhone("50994421248")).toBeNull(); // 11 digits, doesn't start with 0
  });
});

describe("extractDomain", () => {
  it("strips protocol and www", () => {
    expect(extractDomain("https://www.example.com")).toBe("example.com");
    expect(extractDomain("http://example.com")).toBe("example.com");
  });

  it("strips trailing paths", () => {
    expect(extractDomain("https://example.com/about")).toBe("example.com");
  });

  it("returns an empty string for null", () => {
    expect(extractDomain(null)).toBe("");
  });
});
