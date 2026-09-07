import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEV_ADMIN_PASSWORD = "ChangeMe123!";
const DEV_PROCESSOR_PASSWORD = "ChangeMe123!";

const STARTER_TEMPLATES = [
  "Use our AI domain generator to safeguard your online presence. By owning every close variant of {domain}, you protect your brand, your web traffic, and your sales — and make sure customers always find the right site.",
  "Someone searching for you by name can land on a lookalike of {domain} instead of you. Securing the matching .in and .co.in alongside {domain} closes that gap before a competitor — or a scammer — finds it first.",
  "Local domains near {domain} are being registered faster than ever this quarter. Locking in the variants next to {domain} now keeps your listing, and your customers, pointed at the real thing.",
];

const SAMPLE_RECORDS = [
  { name: "ABC Motors", phone: "+91 98765 43210", rating: 4.5, mapsUrl: "https://maps.google.com/?q=ABC+Motors+Puducherry", websiteUrl: "https://abcmotors.com" },
  { name: "Sri Lakshmi Textiles", phone: "+91 90031 22456", rating: 4.2, mapsUrl: "https://maps.google.com/?q=Sri+Lakshmi+Textiles+Madurai", websiteUrl: "https://srilakshmitextiles.in" },
  { name: "Coastal Bites Cafe", phone: "+91 63801 77654", rating: 4.7, mapsUrl: "https://maps.google.com/?q=Coastal+Bites+Cafe+Pondicherry", websiteUrl: "https://coastalbites.co.in" },
  { name: "Everest Traders", phone: "+91 94422 10987", rating: null, mapsUrl: null, websiteUrl: "https://everesttraders.com" },
  { name: "Northwind Auto Care", phone: "+91 89400 55321", rating: 4.1, mapsUrl: "https://maps.google.com/?q=Northwind+Auto+Care+Chennai", websiteUrl: null },
];

async function main() {
  const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
  if (adminCount === 0) {
    await prisma.user.create({
      data: {
        name: "Admin",
        username: "admin",
        email: "admin@example.com",
        passwordHash: await bcrypt.hash(DEV_ADMIN_PASSWORD, 12),
        role: "ADMIN",
      },
    });
    console.log(`Created admin user — username: admin / password: ${DEV_ADMIN_PASSWORD}`);
  }

  const processorExists = await prisma.user.findUnique({ where: { username: "processor1" } });
  if (!processorExists) {
    await prisma.user.create({
      data: {
        name: "Data Processor",
        username: "processor1",
        email: "processor1@example.com",
        passwordHash: await bcrypt.hash(DEV_PROCESSOR_PASSWORD, 12),
        role: "DATA_PROCESSOR",
      },
    });
    console.log(`Created data processor user — username: processor1 / password: ${DEV_PROCESSOR_PASSWORD}`);
  }

  const dictionaryCount = await prisma.templateDictionary.count();
  if (dictionaryCount === 0) {
    await prisma.templateDictionary.create({
      data: {
        name: "Default",
        isActive: true,
        templates: {
          create: STARTER_TEMPLATES.map((body, i) => ({ body, position: i })),
        },
      },
    });
    console.log("Created default template dictionary with 3 starter templates.");
  }

  const fileCount = await prisma.sourceFile.count();
  if (fileCount === 0) {
    await prisma.sourceFile.create({
      data: {
        filename: "sample-leads.csv",
        totalRows: SAMPLE_RECORDS.length,
        removedMissingName: 0,
        removedMissingPhone: 0,
        records: {
          create: SAMPLE_RECORDS.map((r, i) => ({ ...r, rowIndex: i })),
        },
      },
    });
    console.log(`Created sample source file with ${SAMPLE_RECORDS.length} records.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
