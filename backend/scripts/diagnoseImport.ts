import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Vérifier les companies : ont-elles externalRef ?
  const companies = await prisma.company.findMany({
    take: 10,
    select: { id: true, name: true, externalRef: true, siret: true }
  });

  // eslint-disable-next-line no-console
  console.log('\n=== COMPANIES (10 premiers) ===');
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(companies, null, 2));

  const companiesWithExternalRef = await prisma.company.count({ where: { externalRef: { not: null } } });
  const companiesWithoutExternalRef = await prisma.company.count({ where: { externalRef: null } });

  // eslint-disable-next-line no-console
  console.log(`\nCompanies avec externalRef: ${companiesWithExternalRef}`);
  // eslint-disable-next-line no-console
  console.log(`Companies sans externalRef: ${companiesWithoutExternalRef}`);

  // 2. Vérifier les contacts : combien ont un companyId ? Quel companyId ?
  const contacts = await prisma.contact.findMany({
    take: 10,
    select: { id: true, firstName: true, lastName: true, email: true, externalRef: true, companyId: true }
  });

  // eslint-disable-next-line no-console
  console.log('\n=== CONTACTS (10 premiers) ===');
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(contacts, null, 2));

  const contactsWithCompany = await prisma.contact.count({ where: { companyId: { not: null } } });
  const contactsWithoutCompany = await prisma.contact.count({ where: { companyId: null } });

  // eslint-disable-next-line no-console
  console.log(`\nContacts avec companyId: ${contactsWithCompany}`);
  // eslint-disable-next-line no-console
  console.log(`Contacts sans companyId: ${contactsWithoutCompany}`);

  // 3. Vérifier la distribution des companyId (s'il y a un seul companyId pour tous les contacts, c'est le problème)
  const companyIdDistribution = await prisma.$queryRawUnsafe<Array<{ companyId: string | null; count: number }>>(
    `SELECT "companyId", COUNT(*)::int as count
     FROM "Contact"
     WHERE "companyId" IS NOT NULL
     GROUP BY "companyId"
     ORDER BY count DESC
     LIMIT 10`
  );

  // eslint-disable-next-line no-console
  console.log('\n=== DISTRIBUTION DES companyId DANS CONTACTS ===');
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(companyIdDistribution, null, 2));

  // 4. Vérifier si les companyId des contacts correspondent à des Company.id existants
  const orphanContacts = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::int as count
     FROM "Contact" c
     LEFT JOIN "Company" co ON c."companyId" = co.id
     WHERE c."companyId" IS NOT NULL
       AND co.id IS NULL`
  );

  // eslint-disable-next-line no-console
  console.log(`\nContacts avec companyId orphelin (ne correspond à aucun Company): ${orphanContacts[0]?.count || 0}`);

  // 5. Exemple : un contact avec son company et vérifier si externalRef match
  const sampleContact = await prisma.contact.findFirst({
    where: { companyId: { not: null } },
    include: { company: { select: { id: true, name: true, externalRef: true } } }
  });

  // eslint-disable-next-line no-console
  console.log('\n=== EXEMPLE CONTACT AVEC COMPANY ===');
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(sampleContact, null, 2));
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

