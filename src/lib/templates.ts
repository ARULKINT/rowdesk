export const STARTER_TEMPLATES: string[] = [
  "Use our AI domain generator to safeguard your online presence. By owning every close variant of {domain}, you protect your brand, your web traffic, and your sales — and make sure customers always find the right site.",
  "Someone searching for you by name can land on a lookalike of {domain} instead of you. Securing the matching .in and .co.in alongside {domain} closes that gap before a competitor — or a scammer — finds it first.",
  "Local domains near {domain} are being registered faster than ever this quarter. Locking in the variants next to {domain} now keeps your listing, and your customers, pointed at the real thing.",
];

export interface ComposeValues {
  domain?: string;
  name?: string;
}

const FALLBACKS: Record<keyof ComposeValues, string> = {
  domain: "your-domain.com",
  name: "your business",
};

export function composeMessage(template: string, values: ComposeValues): string {
  let result = template;
  for (const key of Object.keys(FALLBACKS) as (keyof ComposeValues)[]) {
    const value = values[key] || FALLBACKS[key];
    result = result.split(`{${key}}`).join(value);
  }
  return result;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function composeMessageHtml(template: string, values: ComposeValues): string {
  let result = escapeHtml(template);
  for (const key of Object.keys(FALLBACKS) as (keyof ComposeValues)[]) {
    const value = escapeHtml(values[key] || FALLBACKS[key]);
    result = result.split(`{${key}}`).join(`<mark>${value}</mark>`);
  }
  return result;
}
