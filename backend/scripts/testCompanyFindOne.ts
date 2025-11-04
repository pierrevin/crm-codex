import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const companyId = 'cmgi1wu32000x1sve3kpgjtk5'; // ADBS
  const opportunityId = 'cmgi242wx001d1svepwgeky22';

  console.log('=== Test de companies.findOne() comme dans le service ===\n');

  // Simuler exactement ce que fait companies.service.findOne()
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      contacts: true,
      opportunities: true,
      tags: { select: { name: true } }
    }
  });

  if (!company) {
    console.log(`❌ Company ${companyId} non trouvée`);
    await prisma.$disconnect();
    return;
  }

  console.log(`🏢 Company: ${company.name}`);
  console.log(`   ID: ${company.id}`);
  console.log(`   Nombre de contacts: ${company.contacts.length}`);
  console.log(`   Nombre d'opportunités: ${company.opportunities.length}\n`);

  // Vérifier si notre opportunité est dans la liste
  const hasOurOpportunity = company.opportunities.some(opp => opp.id === opportunityId);
  console.log(`📋 Opportunité "ChatGPT 4-5 décembre" présente: ${hasOurOpportunity ? '✅ OUI' : '❌ NON'}\n`);

  // Lister toutes les opportunités retournées
  console.log(`=== Opportunités retournées par Prisma ===`);
  for (const opp of company.opportunities) {
    const isOurOpportunity = opp.id === opportunityId;
    const marker = isOurOpportunity ? ' 👈 NOTRE OPPORTUNITÉ' : '';
    console.log(`   ${opp.title}: companyId=${opp.companyId}${marker}`);
    if (opp.companyId !== companyId) {
      console.log(`      ⚠️  ATTENTION: companyId ne correspond pas ! Attendu: ${companyId}, Actuel: ${opp.companyId}`);
    }
  }

  // Vérifier toutes les opportunités en BDD pour cette company
  console.log(`\n=== Vérification directe en BDD ===`);
  const allOpportunitiesForCompany = await prisma.opportunity.findMany({
    where: { companyId: companyId }
  });
  console.log(`Nombre d'opportunités avec companyId=${companyId}: ${allOpportunitiesForCompany.length}`);
  const hasOurOpportunityInDB = allOpportunitiesForCompany.some(opp => opp.id === opportunityId);
  console.log(`Opportunité "ChatGPT 4-5 décembre" en BDD: ${hasOurOpportunityInDB ? '✅ OUI' : '❌ NON'}`);

  // Vérifier s'il y a des opportunités avec un companyId différent
  const wrongOpportunities = company.opportunities.filter(opp => opp.companyId !== companyId);
  if (wrongOpportunities.length > 0) {
    console.log(`\n❌ PROBLÈME: ${wrongOpportunities.length} opportunité(s) avec un companyId incorrect:`);
    for (const opp of wrongOpportunities) {
      console.log(`   - ${opp.title}: companyId=${opp.companyId} (attendu: ${companyId})`);
    }
  } else {
    console.log(`\n✅ Toutes les opportunités retournées ont le bon companyId`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);

