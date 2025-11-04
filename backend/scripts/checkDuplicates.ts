import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const report: any = { contacts: {}, companies: {} };

  // Contacts: doublons email
  report.contacts.email = await prisma.$queryRawUnsafe<any[]>(
    `SELECT email, COUNT(*)::int as count, ARRAY_AGG(id) as ids
     FROM "Contact"
     WHERE email IS NOT NULL AND email <> ''
     GROUP BY email
     HAVING COUNT(*) > 1
     ORDER BY COUNT(*) DESC`
  );

  // Contacts: doublons externalRef
  report.contacts.externalRef = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "externalRef", COUNT(*)::int as count, ARRAY_AGG(id) as ids
     FROM "Contact"
     WHERE "externalRef" IS NOT NULL AND "externalRef" <> ''
     GROUP BY "externalRef"
     HAVING COUNT(*) > 1
     ORDER BY COUNT(*) DESC`
  );

  // Contacts: doublons triplet (firstName,lastName,companyId) pour ceux sans email/externalRef
  report.contacts.triplet = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "companyId",
            LOWER(TRIM(COALESCE("firstName", ''))) AS first,
            LOWER(TRIM(COALESCE("lastName", '')))  AS last,
            COUNT(*)::int as count,
            ARRAY_AGG(id) as ids
     FROM "Contact"
     WHERE (email IS NULL OR email = '')
       AND ("externalRef" IS NULL OR "externalRef" = '')
     GROUP BY "companyId", LOWER(TRIM(COALESCE("firstName", ''))), LOWER(TRIM(COALESCE("lastName", '')))
     HAVING COUNT(*) > 1
     ORDER BY COUNT(*) DESC`
  );

  // Companies: doublons siret
  report.companies.siret = await prisma.$queryRawUnsafe<any[]>(
    `SELECT siret, COUNT(*)::int as count, ARRAY_AGG(id) as ids
     FROM "Company"
     WHERE siret IS NOT NULL AND siret <> ''
     GROUP BY siret
     HAVING COUNT(*) > 1
     ORDER BY COUNT(*) DESC`
  );

  // Companies: doublons externalRef
  report.companies.externalRef = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "externalRef", COUNT(*)::int as count, ARRAY_AGG(id) as ids
     FROM "Company"
     WHERE "externalRef" IS NOT NULL AND "externalRef" <> ''
     GROUP BY "externalRef"
     HAVING COUNT(*) > 1
     ORDER BY COUNT(*) DESC`
  );

  // Companies: doublons triplet (name, zip, city)
  report.companies.triplet = await prisma.$queryRawUnsafe<any[]>(
    `SELECT LOWER(TRIM(name)) AS name,
            LOWER(TRIM(COALESCE("addressZip", '')))  AS zip,
            LOWER(TRIM(COALESCE("addressCity", ''))) AS city,
            COUNT(*)::int as count,
            ARRAY_AGG(id) as ids
     FROM "Company"
     GROUP BY LOWER(TRIM(name)), LOWER(TRIM(COALESCE("addressZip", ''))), LOWER(TRIM(COALESCE("addressCity", '')))
     HAVING COUNT(*) > 1
     ORDER BY COUNT(*) DESC`
  );

  const safeStringify = (obj: any) => JSON.stringify(obj, (_k, v) => (typeof v === 'bigint' ? Number(v) : v), 2);
  // eslint-disable-next-line no-console
  console.log(safeStringify(report));
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


