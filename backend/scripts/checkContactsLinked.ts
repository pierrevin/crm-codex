import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.contact.count();
  const withCompany = await prisma.contact.count({ where: { companyId: { not: null } } });
  const withoutCompany = await prisma.contact.count({ where: { companyId: null } });

  // eslint-disable-next-line no-console
  console.log(`Total contacts: ${total}`);
  // eslint-disable-next-line no-console
  console.log(`Avec company: ${withCompany}`);
  // eslint-disable-next-line no-console
  console.log(`Sans company: ${withoutCompany}`);

  // Exemple de contacts sans company
  const sample = await prisma.contact.findMany({
    where: { companyId: null },
    take: 5,
    select: { id: true, firstName: true, lastName: true, email: true, externalRef: true }
  });

  // eslint-disable-next-line no-console
  console.log('\nExemples de contacts sans company:');
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(sample, null, 2));
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

