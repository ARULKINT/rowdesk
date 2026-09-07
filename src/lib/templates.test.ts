import { describe, expect, it } from "vitest";
import { composeMessage, composeMessageHtml, STARTER_TEMPLATES } from "./templates";

describe("composeMessage", () => {
  it("substitutes {domain} with the record's domain", () => {
    expect(composeMessage("Protect {domain} today.", "example.com")).toBe(
      "Protect example.com today."
    );
  });

  it("substitutes every occurrence of {domain}", () => {
    expect(composeMessage("{domain} and {domain} again", "example.com")).toBe(
      "example.com and example.com again"
    );
  });

  it("falls back to a placeholder domain when none is known", () => {
    expect(composeMessage("Protect {domain}.", "")).toBe("Protect your-domain.com.");
  });
});

describe("composeMessageHtml", () => {
  it("wraps the substituted domain in a <mark> tag", () => {
    expect(composeMessageHtml("Protect {domain}.", "example.com")).toBe(
      "Protect <mark>example.com</mark>."
    );
  });

  it("HTML-escapes the template body — an admin can't inject markup via a template", () => {
    const malicious = "Click <img src=x onerror=alert(1)> for {domain}";
    const html = composeMessageHtml(malicious, "example.com");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("HTML-escapes the domain — a crafted CSV value can't inject markup either", () => {
    const html = composeMessageHtml("Visit {domain}", '"><script>alert(1)</script>');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("STARTER_TEMPLATES", () => {
  it("ships exactly the three starter templates, each containing the {domain} placeholder", () => {
    expect(STARTER_TEMPLATES).toHaveLength(3);
    for (const t of STARTER_TEMPLATES) {
      expect(t).toContain("{domain}");
    }
  });
});
