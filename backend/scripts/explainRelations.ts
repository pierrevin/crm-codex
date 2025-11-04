import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // eslint-disable-next-line no-console
  console.log('📊 STRUCTURE DE LA BASE DE DONNÉES\n');
  // eslint-disable-next-line no-console
  console.log('=== COMPANY ===');
  // eslint-disable-next-line no-console
  console.log('  - id (cuid, ex: "cmhkggsxu00011s7qnpi2rg7p")');
  // eslint-disable-next-line no-console
  console.log('  - externalRef (ex: "37888710" = "Id de la société" du CSV)');
  // eslint-disable-next-line no-console
  console.log('  - name, siret, etc.');
  // eslint-disable-next-line no-console
  console.log('  - contacts (relation) → liste des Contact liés\n');

  // eslint-disable-next-line no-console
  console.log('=== CONTACT ===');
  // eslint-disable-next-line no-console
  console.log('  - id (cuid)');
  // eslint-disable-next-line no-console
  console.log('  - externalRef (ex: "36105794" = "Id du contact" du CSV)');
  // eslint-disable-next-line no-console
  console.log('  - companyId (FK) → pointe vers Company.id');
  // eslint-disable-next-line no-console
  console.log('  - company (relation) → Company liée\n');

  // eslint-disable-next-line no-console
  console.log('🔗 RELATION:');
  // eslint-disable-next-line no-console
  console.log('  Contact.companyId → Company.id');
  // eslint-disable-next-line no-console
  console.log('  (pas de Company.companyId, c\'est Contact qui a la clé étrangère)\n');

  // Exemple concret
  const exampleCompany = await prisma.company.findFirst({
    where: { externalRef: { not: null } },
    include: { contacts: { take: 3, select: { id: true, firstName: true, lastName: true, companyId: true } } }
  });

  if (exampleCompany) {
    // eslint-disable-next-line no-console
    console.log('=== EXEMPLE CONCRET ===\n');
    // eslint-disable-next-line no-console
    console.log(`Company: ${exampleCompany.name}`);
    // eslint-disable-next-line no-console
    console.log(`  - id: ${exampleCompany.id}`);
    // eslint-disable-next-line no-console
    console.log(`  - externalRef: ${exampleCompany.externalRef}\n`);
    // eslint-disable-next-line no-console
    console.log(`Contacts associés (${exampleCompany.contacts.length}):`);
    for (const contact of exampleCompany.contacts) {
      // eslint-disable-next-line no-console
      console.log(`  - ${contact.firstName} ${contact.lastName || ''} (companyId: ${contact.companyId})`);
      // eslint-disable-next-line no-console
      console.log(`    → companyId pointe vers Company.id: ${contact.companyId === exampleCompany.id ? '✅' : '❌'}`);
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

