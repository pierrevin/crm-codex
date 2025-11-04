import { PrismaClient } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  // 1. Trouver la company Terre Ecos
  const terreEcos = await prisma.company.findFirst({
    where: { externalRef: '6742344' }
  });

  if (!terreEcos) {
    // eslint-disable-next-line no-console
    console.log('❌ Company Terre Ecos (externalRef: 6742344) non trouvée');
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`✅ Company Terre Ecos trouvée: ${terreEcos.name} (id: ${terreEcos.id})`);

  // 2. Trouver le contact Thomas Turini
  const thomas = await prisma.contact.findFirst({
    where: { email: 't.turini@terre-ecos.com' },
    include: { company: { select: { id: true, name: true, externalRef: true } } }
  });

  if (!thomas) {
    // eslint-disable-next-line no-console
    console.log('❌ Contact Thomas Turini non trouvé');
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`\nContact Thomas Turini:`);
  // eslint-disable-next-line no-console
  console.log(`  - ID: ${thomas.id}`);
  // eslint-disable-next-line no-console
  console.log(`  - ExternalRef: ${thomas.externalRef || 'N/A'}`);
  // eslint-disable-next-line no-console
  console.log(`  - CompanyId actuel: ${thomas.companyId}`);
  if (thomas.company) {
    // eslint-disable-next-line no-console
    console.log(`  - Company actuelle: ${thomas.company.name} (externalRef: ${thomas.company.externalRef || 'N/A'})`);
  }

  // 3. Vérifier dans le CSV quel était le "Id de la société" pour ce contact
  const contactsPath = path.join(process.cwd(), '..', 'BDD_archives', 'Save_contacts_Axonaut.csv');
  const contactsCsv = await fs.readFile(contactsPath, 'utf8');

  const lines = contactsCsv.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) {
    // eslint-disable-next-line no-console
    console.log('❌ Fichier CSV contacts vide');
    return;
  }

  const headers = lines[0].split(';').map((h) => h.trim().replace(/^"|"$/g, ''));
  const idSocieteIndex = headers.indexOf('Id de la société');
  const emailIndex = headers.indexOf('Email du contact');
  const firstNameIndex = headers.indexOf('Prénom du contact');
  const lastNameIndex = headers.indexOf('Nom du contact');

  if (idSocieteIndex === -1 || emailIndex === -1) {
    // eslint-disable-next-line no-console
    console.log('❌ Colonnes "Id de la société" ou "Email du contact" non trouvées dans le CSV');
    return;
  }

  // Chercher le contact dans le CSV
  let csvIdSociete: string | null = null;
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(';').map((p) => p.trim().replace(/^"|"$/g, ''));
    const email = parts[emailIndex] || '';
    const firstName = parts[firstNameIndex] || '';
    const lastName = parts[lastNameIndex] || '';

    if (email === 't.turini@terre-ecos.com' || (firstName === 'Thomas' && lastName === 'Turini')) {
      csvIdSociete = parts[idSocieteIndex] || null;
      // eslint-disable-next-line no-console
      console.log(`\n📄 Dans le CSV:`);
      // eslint-disable-next-line no-console
      console.log(`  - "Id de la société": ${csvIdSociete || 'VIDE'}`);
      break;
    }
  }

  // 4. Vérifier si cette company existe
  if (csvIdSociete) {
    const expectedCompany = await prisma.company.findFirst({
      where: { externalRef: csvIdSociete.trim() }
    });

    if (expectedCompany) {
      // eslint-disable-next-line no-console
      console.log(`\n✅ Company avec externalRef "${csvIdSociete}" trouvée: ${expectedCompany.name} (id: ${expectedCompany.id})`);
      if (expectedCompany.id === terreEcos.id) {
        // eslint-disable-next-line no-console
        console.log(`  ✅ C'est bien Terre Ecos !`);
        // eslint-disable-next-line no-console
        console.log(`\n🔧 Correction : association du contact à Terre Ecos...`);
        await prisma.contact.update({
          where: { id: thomas.id },
          data: { companyId: terreEcos.id }
        });
        // eslint-disable-next-line no-console
        console.log(`  ✅ Contact corrigé !`);
      } else {
        // eslint-disable-next-line no-console
        console.log(`  ❌ Ce n'est PAS Terre Ecos, c'est ${expectedCompany.name}`);
        // eslint-disable-next-line no-console
        console.log(`  ⚠️  Le contact devrait être associé à ${expectedCompany.name} selon le CSV`);
      }
    } else {
      // eslint-disable-next-line no-console
      console.log(`\n❌ Aucune company avec externalRef "${csvIdSociete}" trouvée`);
      // eslint-disable-next-line no-console
      console.log(`  🔧 Correction : association du contact à Terre Ecos (manuelle)...`);
      await prisma.contact.update({
        where: { id: thomas.id },
        data: { companyId: terreEcos.id }
      });
      // eslint-disable-next-line no-console
      console.log(`  ✅ Contact corrigé !`);
    }
  } else {
    // eslint-disable-next-line no-console
    console.log(`\n⚠️  "Id de la société" vide dans le CSV pour ce contact`);
    // eslint-disable-next-line no-console
    console.log(`  🔧 Correction : association du contact à Terre Ecos (manuelle)...`);
    await prisma.contact.update({
      where: { id: thomas.id },
      data: { companyId: terreEcos.id }
    });
    // eslint-disable-next-line no-console
    console.log(`  ✅ Contact corrigé !`);
  }

  // 5. Vérifier combien de contacts sont associés à Terre Ecos
  const count = await prisma.contact.count({
    where: { companyId: terreEcos.id }
  });
  // eslint-disable-next-line no-console
  console.log(`\n📊 Contacts associés à Terre Ecos: ${count}`);
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

