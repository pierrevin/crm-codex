import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Prendre Terre Ecos comme exemple
  const terreEcos = await prisma.company.findFirst({
    where: { externalRef: '6742344' },
    include: { contacts: { take: 5, select: { id: true, firstName: true, lastName: true, companyId: true } } }
  });

  if (!terreEcos) {
    // eslint-disable-next-line no-console
    console.log('❌ Terre Ecos non trouvée');
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`=== COMPANY: ${terreEcos.name} ===\n`);
  // eslint-disable-next-line no-console
  console.log(`Company.id = "${terreEcos.id}"`);
  // eslint-disable-next-line no-console
  console.log(`Company.externalRef = "${terreEcos.externalRef}"\n`);

  // eslint-disable-next-line no-console
  console.log(`=== CONTACTS ASSOCIÉS ===\n`);
  for (const contact of terreEcos.contacts) {
    // eslint-disable-next-line no-console
    console.log(`Contact: ${contact.firstName} ${contact.lastName || ''}`);
    // eslint-disable-next-line no-console
    console.log(`  Contact.companyId = "${contact.companyId}"`);
    // eslint-disable-next-line no-console
    console.log(`  Company.id = "${terreEcos.id}"`);
    // eslint-disable-next-line no-console
    console.log(`  ✅ Match: ${contact.companyId === terreEcos.id ? 'OUI' : 'NON'}\n`);
  }

  // Vérifier aussi un contact qui devrait être associé mais ne l'est pas
  const thomas = await prisma.contact.findFirst({
    where: { email: 't.turini@terre-ecos.com' },
    include: { company: { select: { id: true, name: true, externalRef: true } } }
  });

  if (thomas) {
    // eslint-disable-next-line no-console
    console.log(`\n=== CONTACT THOMAS TURINI ===\n`);
    // eslint-disable-next-line no-console
    console.log(`Contact.companyId = "${thomas.companyId}"`);
    // eslint-disable-next-line no-console
    console.log(`Company.id attendu (Terre Ecos) = "${terreEcos.id}"`);
    // eslint-disable-next-line no-console
    console.log(`  ✅ Match: ${thomas.companyId === terreEcos.id ? 'OUI' : 'NON'}`);
    if (thomas.company) {
      // eslint-disable-next-line no-console
      console.log(`  Company actuelle: ${thomas.company.name} (id: ${thomas.company.id})`);
    }
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

