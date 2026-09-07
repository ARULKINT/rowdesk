export const STARTER_TEMPLATES: string[] = [
  "Use our AI domain generator to safeguard your online presence. By owning every close variant of {domain}, you protect your brand, your web traffic, and your sales — and make sure customers always find the right site.",
  "Someone searching for you by name can land on a lookalike of {domain} instead of you. Securing the matching .in and .co.in alongside {domain} closes that gap before a competitor — or a scammer — finds it first.",
  "Local domains near {domain} are being registered faster than ever this quarter. Locking in the variants next to {domain} now keeps your listing, and your customers, pointed at the real thing.",
];

export function composeMessage(template: string, domain: string): string {
  return template.split("{domain}").join(domain || "your-domain.com");
}

export function composeMessageHtml(template: string, domain: string): string {
  const value = domain || "your-domain.com";
  const escaped = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return template
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .split("{domain}")
    .join(`<mark>${escaped}</mark>`);
}
