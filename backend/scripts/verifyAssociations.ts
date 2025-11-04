import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Vérifier que les contacts sont bien associés aux bonnes companies
  // via la relation : Contact.companyId → Company.id → Company.externalRef

  // Exemple : prendre quelques contacts avec companyId et vérifier
  const contacts = await prisma.contact.findMany({
    where: { companyId: { not: null } },
    take: 10,
    include: {
      company: {
        select: { id: true, name: true, externalRef: true }
      }
    }
  });

  // eslint-disable-next-line no-console
  console.log('\n=== VÉRIFICATION ASSOCIATIONS CONTACT → COMPANY ===\n');

  for (const contact of contacts) {
    // eslint-disable-next-line no-console
    console.log(`Contact: ${contact.firstName} ${contact.lastName || ''} (externalRef: ${contact.externalRef || 'N/A'})`);
    // eslint-disable-next-line no-console
    console.log(`  → companyId: ${contact.companyId}`);
    if (contact.company) {
      // eslint-disable-next-line no-console
      console.log(`  → Company: ${contact.company.name} (id: ${contact.company.id}, externalRef: ${contact.company.externalRef || 'N/A'})`);
      // eslint-disable-next-line no-console
      console.log(`  ✅ Contact.companyId pointe vers Company.id`);
    } else {
      // eslint-disable-next-line no-console
      console.log(`  ❌ Contact.companyId orphelin (company n'existe pas)`);
    }
    // eslint-disable-next-line no-console
    console.log('');
  }

  // Vérifier les contacts mal associés (companyId existe mais externalRef ne correspond pas)
  // Note: on ne peut pas vérifier directement car on n'a pas le "Id de la société" du CSV dans Contact
  // Mais on peut vérifier qu'il n'y a pas de contacts orphelins

  const orphanContacts = await prisma.contact.count({
    where: {
      companyId: { not: null },
      company: null
    }
  });

  // eslint-disable-next-line no-console
  console.log(`\nContacts avec companyId orphelin (company n'existe pas): ${orphanContacts}`);

  // Vérifier la distribution
  const companiesWithContacts = await prisma.company.findMany({
    where: {
      contacts: { some: {} }
    },
    include: {
      _count: {
        select: { contacts: true }
      }
    },
    orderBy: {
      contacts: { _count: 'desc' }
    },
    take: 10
  });

  // eslint-disable-next-line no-console
  console.log('\n=== TOP 10 COMPANIES AVEC LE PLUS DE CONTACTS ===\n');
  for (const company of companiesWithContacts) {
    // eslint-disable-next-line no-console
    console.log(`${company.name} (externalRef: ${company.externalRef || 'N/A'}) → ${company._count.contacts} contacts`);
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

