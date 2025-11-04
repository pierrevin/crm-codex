import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const opportunityId = 'cmgi242wx001d1svepwgeky22';
  const expectedCompanyId = 'cmgi1wu32000x1sve3kpgjtk5';

  console.log('=== Diagnostic association opportunité ===\n');

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
  console.log(`   ID: ${opportunity.id}`);
  console.log(`   Stage: ${opportunity.stage}`);
  console.log(`   Amount: ${opportunity.amount}`);
  console.log(`   CompanyId actuel: ${opportunity.companyId || 'NULL'}`);
  console.log(`   ContactId: ${opportunity.contactId || 'NULL'}`);

  if (opportunity.company) {
    console.log(`\n🏢 Company associée actuelle:`);
    console.log(`   ID: ${opportunity.company.id}`);
    console.log(`   Nom: ${opportunity.company.name}`);
    console.log(`   ExternalRef: ${opportunity.company.externalRef || 'NULL'}`);
  } else {
    console.log(`\n⚠️  Aucune company associée (companyId = null)`);
  }

  // Récupérer la company attendue
  const expectedCompany = await prisma.company.findUnique({
    where: { id: expectedCompanyId }
  });

  if (expectedCompany) {
    console.log(`\n🎯 Company attendue (ADBS):`);
    console.log(`   ID: ${expectedCompany.id}`);
    console.log(`   Nom: ${expectedCompany.name}`);
    console.log(`   ExternalRef: ${expectedCompany.externalRef || 'NULL'}`);
  } else {
    console.log(`\n❌ Company attendue ${expectedCompanyId} non trouvée`);
  }

  // Vérifier si le contact a une company associée
  if (opportunity.contact && opportunity.contact.companyId) {
    const contactCompany = await prisma.company.findUnique({
      where: { id: opportunity.contact.companyId }
    });
    console.log(`\n👤 Contact associé:`);
    console.log(`   Nom: ${opportunity.contact.firstName} ${opportunity.contact.lastName || ''}`);
    console.log(`   Email: ${opportunity.contact.email || 'NULL'}`);
    console.log(`   CompanyId du contact: ${opportunity.contact.companyId}`);
    if (contactCompany) {
      console.log(`   Company du contact: ${contactCompany.name} (${contactCompany.id})`);
    }
  }

  // Analyse
  console.log(`\n=== Analyse ===`);
  if (opportunity.companyId === expectedCompanyId) {
    console.log(`✅ L'opportunité est correctement associée à ADBS`);
  } else {
    console.log(`❌ L'opportunité n'est PAS associée à ADBS`);
    console.log(`   Actuel: ${opportunity.companyId || 'NULL'}`);
    console.log(`   Attendu: ${expectedCompanyId}`);
    
    if (opportunity.contact?.companyId === expectedCompanyId) {
      console.log(`\n💡 Le contact associé à l'opportunité est lié à ADBS`);
      console.log(`   On pourrait corriger en copiant le companyId du contact`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);

