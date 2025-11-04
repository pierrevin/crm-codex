import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const opportunityId = 'cmgi242wx001d1svepwgeky22';
  const expectedCompanyId = 'cmgi1wu32000x1sve3kpgjtk5';

  console.log('=== Recherche de l\'opportunité dans toutes les companies ===\n');

  // Récupérer l'opportunité
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      company: true,
      contact: true
    }
  });

  if (!opportunity) {
    console.log(`❌ Opportunité ${opportunityId} non trouvée`);
    await prisma.$disconnect();
    return;
  }

  console.log(`📋 Opportunité: ${opportunity.title}`);
  console.log(`   CompanyId en BDD: ${opportunity.companyId || 'NULL'}\n`);

  // Récupérer toutes les companies qui ont cette opportunité dans leur relation
  const allCompanies = await prisma.company.findMany({
    include: {
      opportunities: {
        where: { id: opportunityId }
      }
    }
  });

  console.log(`=== Companies qui ont cette opportunité dans leur relation ===`);
  let foundInRelation = false;
  for (const company of allCompanies) {
    if (company.opportunities.length > 0) {
      foundInRelation = true;
      console.log(`\n🏢 Company: ${company.name}`);
      console.log(`   ID: ${company.id}`);
      console.log(`   ExternalRef: ${company.externalRef || 'NULL'}`);
      console.log(`   ${company.id === expectedCompanyId ? '✅ CORRECTE' : '❌ INCORRECTE (ne devrait pas avoir cette opportunité)'}`);
    }
  }

  if (!foundInRelation) {
    console.log(`\n⚠️  Aucune company n'a cette opportunité dans sa relation`);
    console.log(`   Cela suggère que Prisma ne retourne pas l'opportunité via include`);
  }

  // Vérifier directement avec une requête SQL
  console.log(`\n=== Vérification directe ===`);
  const directCheck = await prisma.opportunity.findMany({
    where: { companyId: { not: null } },
    select: {
      id: true,
      title: true,
      companyId: true
    },
    take: 10
  });

  console.log(`\nExemples d'opportunités et leur companyId:`);
  for (const opp of directCheck) {
    const isOurOpportunity = opp.id === opportunityId;
    const marker = isOurOpportunity ? ' 👈 NOTRE OPPORTUNITÉ' : '';
    console.log(`   ${opp.title}: companyId=${opp.companyId}${marker}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);

