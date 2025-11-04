import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const opportunityId = 'cmgi242wx001d1svepwgeky22';

  console.log('=== Vérification de toutes les opportunités ===\n');

  // Vérifier si cette opportunité apparaît dans plusieurs companies
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: { company: true }
  });

  if (!opportunity) {
    console.log(`❌ Opportunité ${opportunityId} non trouvée`);
    await prisma.$disconnect();
    return;
  }

  console.log(`📋 Opportunité: ${opportunity.title}`);
  console.log(`   CompanyId: ${opportunity.companyId || 'NULL'}\n`);

  // Vérifier toutes les companies qui pourraient avoir cette opportunité
  const allCompanies = await prisma.company.findMany({
    include: {
      opportunities: {
        where: { id: opportunityId }
      }
    }
  });

  console.log(`=== Companies qui ont cette opportunité dans leur relation ===`);
  const companiesWithThisOpp = allCompanies.filter(c => c.opportunities.length > 0);
  
  if (companiesWithThisOpp.length === 0) {
    console.log(`⚠️  Aucune company n'a cette opportunité dans sa relation`);
  } else if (companiesWithThisOpp.length === 1) {
    console.log(`✅ Une seule company a cette opportunité: ${companiesWithThisOpp[0].name}`);
  } else {
    console.log(`❌ PROBLÈME: ${companiesWithThisOpp.length} companies ont cette opportunité:`);
    for (const company of companiesWithThisOpp) {
      console.log(`   - ${company.name} (${company.id})`);
    }
  }

  // Vérifier s'il y a des opportunités avec companyId NULL ou incorrect
  console.log(`\n=== Vérification des opportunités avec companyId problématique ===`);
  const oppsWithNullCompany = await prisma.opportunity.findMany({
    where: { companyId: null },
    take: 10
  });
  console.log(`Opportunités avec companyId=NULL: ${oppsWithNullCompany.length}`);
  if (oppsWithNullCompany.length > 0) {
    console.log(`   Exemples:`);
    for (const opp of oppsWithNullCompany.slice(0, 5)) {
      console.log(`   - ${opp.title} (${opp.id})`);
    }
  }

  // Vérifier s'il y a des opportunités avec des companyId qui n'existent pas
  const allOpportunities = await prisma.opportunity.findMany({
    where: { companyId: { not: null } },
    include: { company: true },
    take: 20
  });

  const orphanOpportunities = allOpportunities.filter(opp => !opp.company);
  console.log(`\nOpportunités avec companyId inexistant: ${orphanOpportunities.length}`);
  if (orphanOpportunities.length > 0) {
    console.log(`   Exemples:`);
    for (const opp of orphanOpportunities.slice(0, 5)) {
      console.log(`   - ${opp.title}: companyId=${opp.companyId} (company non trouvée)`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);

