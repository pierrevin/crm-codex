import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Prendre une company avec externalRef
  const company = await prisma.company.findFirst({
    where: { externalRef: { not: null } },
    select: { id: true, name: true, externalRef: true }
  });

  if (!company) {
    // eslint-disable-next-line no-console
    console.log('Aucune company avec externalRef trouvée');
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`\n=== TEST AVEC COMPANY: ${company.name} (externalRef: ${company.externalRef}) ===`);

  // 1. Contacts via relation Prisma (comme findOne)
  const contactsViaRelation = await prisma.company.findUnique({
    where: { id: company.id },
    include: { contacts: { select: { id: true, firstName: true, lastName: true, email: true } } }
  });

  // eslint-disable-next-line no-console
  console.log(`\nContacts via relation Prisma: ${contactsViaRelation?.contacts.length || 0}`);

  // 2. Contacts via filtre companyId (comme list)
  const contactsViaFilter = await prisma.contact.findMany({
    where: { companyId: company.id },
    select: { id: true, firstName: true, lastName: true, email: true }
  });

  // eslint-disable-next-line no-console
  console.log(`Contacts via filtre companyId: ${contactsViaFilter.length}`);

  // 3. Vérifier si les contacts ont bien le bon companyId
  const contactsWithCompanyId = await prisma.contact.findMany({
    where: { companyId: company.id },
    select: { id: true, firstName: true, lastName: true, companyId: true }
  });

  // eslint-disable-next-line no-console
  console.log(`\nExemples de contacts (3 premiers):`);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(contactsWithCompanyId.slice(0, 3), null, 2));

  // 4. Vérifier combien de contacts ont un externalRef qui correspond à cette company
  const contactsWithMatchingExternalRef = await prisma.contact.findMany({
    where: {
      externalRef: { not: null },
      company: { externalRef: company.externalRef }
    },
    select: { id: true, firstName: true, externalRef: true, companyId: true }
  });

  // eslint-disable-next-line no-console
  console.log(`\nContacts avec externalRef qui correspond à cette company (${company.externalRef}): ${contactsWithMatchingExternalRef.length}`);
  if (contactsWithMatchingExternalRef.length > 0) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(contactsWithMatchingExternalRef.slice(0, 3), null, 2));
  }

  // 5. Vérifier s'il y a des contacts avec le bon externalRef mais le mauvais companyId
  const contactsWithWrongCompany = await prisma.contact.findMany({
    where: {
      externalRef: { not: null },
      company: { externalRef: company.externalRef },
      companyId: { not: company.id }
    },
    select: { id: true, firstName: true, externalRef: true, companyId: true }
  });

  // eslint-disable-next-line no-console
  console.log(`\n⚠️ Contacts avec externalRef correspondant mais MAUVAIS companyId: ${contactsWithWrongCompany.length}`);
  if (contactsWithWrongCompany.length > 0) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(contactsWithWrongCompany.slice(0, 3), null, 2));
  }
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

