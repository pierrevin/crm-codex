import { PrismaClient } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  // eslint-disable-next-line no-console
  console.log('🔍 Lecture des CSV (clients + contacts)...\n');

  const contactsPath = path.join(process.cwd(), '..', 'BDD_archives', 'Save_contacts_Axonaut.csv');
  const clientsPath = path.join(process.cwd(), '..', 'BDD_archives', 'Save_clients_Axonaut.csv');
  
  const contactsCsv = await fs.readFile(contactsPath, 'utf8');
  const clientsCsv = await fs.readFile(clientsPath, 'utf8');

  // Parse les deux CSV
  const parseCsvLines = (csv: string) => csv.split(/\r?\n/).filter((l) => l.length > 0);
  
  const contactsLines = parseCsvLines(contactsCsv);
  const clientsLines = parseCsvLines(clientsCsv);
  
  // Combiner les lignes (contacts du fichier clients + contacts du fichier contacts)
  const lines = [...contactsLines];
  if (lines.length === 0) {
    // eslint-disable-next-line no-console
    console.log('❌ Fichier CSV contacts vide');
    return;
  }

  // Parse CSV avec gestion des guillemets et point-virgule
  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        current += ch;
      } else if (ch === ';' && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
    return result;
  };

  const headers = parseCsvLine(lines[0]);
  const idSocieteIndex = headers.indexOf('Id de la société');
  const emailIndex = headers.indexOf('Email du contact');
  const firstNameIndex = headers.indexOf('Prénom du contact');
  const lastNameIndex = headers.indexOf('Nom du contact');
  const idContactIndex = headers.indexOf('Id du contact');

  if (idSocieteIndex === -1) {
    // eslint-disable-next-line no-console
    console.log('❌ Colonne "Id de la société" non trouvée dans le CSV');
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`📊 ${contactsLines.length - 1} lignes dans CSV contacts\n`);

  // Traiter aussi les contacts intégrés dans le fichier clients
  const clientsHeaders = parseCsvLine(clientsLines[0]);
  const clientsIdSocieteIndex = clientsHeaders.indexOf('Id de la société');
  const clientsEmailIndex = clientsHeaders.indexOf('Email du contact');
  const clientsFirstNameIndex = clientsHeaders.indexOf('Prénom du contact');
  const clientsLastNameIndex = clientsHeaders.indexOf('Nom du contact');
  const clientsIdContactIndex = clientsHeaders.indexOf('Id du contact');

  // eslint-disable-next-line no-console
  console.log(`📊 ${clientsLines.length - 1} lignes dans CSV clients (avec contacts intégrés)\n`);

  // Indexer les contacts par email/externalRef/firstName+lastName pour les retrouver rapidement
  const contactsMapByEmail = new Map<string, { id: string; email?: string | null; externalRef?: string | null }>();
  const contactsMapByExternalRef = new Map<string, { id: string; email?: string | null; externalRef?: string | null }>();
  const contactsMapByName = new Map<string, { id: string; email?: string | null; externalRef?: string | null }>();
  
  const allContacts = await prisma.contact.findMany({
    select: { id: true, email: true, externalRef: true, firstName: true, lastName: true }
  });

  for (const contact of allContacts) {
    if (contact.email) {
      contactsMapByEmail.set(contact.email.toLowerCase().trim(), contact);
    }
    if (contact.externalRef) {
      contactsMapByExternalRef.set(contact.externalRef.trim(), contact);
    }
    const nameKey = `${(contact.firstName || '').toLowerCase().trim()}|${(contact.lastName || '').toLowerCase().trim()}`;
    if (contact.firstName) {
      contactsMapByName.set(nameKey, contact);
    }
  }

  // eslint-disable-next-line no-console
  console.log(`📊 ${allContacts.length} contacts indexés en base (par email: ${contactsMapByEmail.size}, par externalRef: ${contactsMapByExternalRef.size}, par nom: ${contactsMapByName.size})\n`);

  // Indexer les companies par externalRef
  const companiesMap = new Map<string, string>(); // externalRef -> companyId
  const allCompanies = await prisma.company.findMany({
    where: { externalRef: { not: null } },
    select: { id: true, externalRef: true }
  });

  for (const company of allCompanies) {
    if (company.externalRef) {
      companiesMap.set(company.externalRef.trim(), company.id);
    }
  }

  // eslint-disable-next-line no-console
  console.log(`📊 ${companiesMap.size} companies indexées\n`);

  let corrected = 0;
  let notFound = 0;
  let alreadyCorrect = 0;
  let noIdSociete = 0;
  let noContact = 0;

  // eslint-disable-next-line no-console
  console.log('🔄 Correction des associations...\n');

  // Traiter les contacts du fichier contacts
  for (let i = 1; i < contactsLines.length; i++) {
    const parts = parseCsvLine(lines[i]);
    const idSociete = (parts[idSocieteIndex] || '').trim();
    const email = (parts[emailIndex] || '').trim().toLowerCase();
    const firstName = (parts[firstNameIndex] || '').trim();
    const lastName = (parts[lastNameIndex] || '').trim();
    const idContact = (parts[idContactIndex] || '').trim();

    if (!idSociete) {
      noIdSociete++;
      continue;
    }

    // Trouver le contact en base (priorité: email > externalRef > nom)
    let contact = email ? contactsMapByEmail.get(email) : null;
    if (!contact && idContact) {
      contact = contactsMapByExternalRef.get(idContact);
    }
    if (!contact && firstName && lastName) {
      const nameKey = `${firstName.toLowerCase().trim()}|${lastName.toLowerCase().trim()}`;
      contact = contactsMapByName.get(nameKey);
    }

    if (!contact) {
      noContact++;
      continue;
    }

    // Trouver la company correspondante
    const companyId = companiesMap.get(idSociete);
    if (!companyId) {
      notFound++;
      continue;
    }

    // Vérifier si déjà correct
    const existing = await prisma.contact.findUnique({
      where: { id: contact.id },
      select: { companyId: true }
    });

    if (existing?.companyId === companyId) {
      alreadyCorrect++;
      continue;
    }

    // Corriger
    await prisma.contact.update({
      where: { id: contact.id },
      data: { companyId }
    });

    corrected++;
    if (corrected % 100 === 0) {
      // eslint-disable-next-line no-console
      console.log(`  ✅ ${corrected} contacts corrigés...`);
    }
  }

  // Traiter aussi les contacts du fichier clients
  if (clientsIdSocieteIndex !== -1 && clientsEmailIndex !== -1) {
    // eslint-disable-next-line no-console
    console.log('\n🔄 Traitement des contacts intégrés dans le fichier clients...\n');
    
    for (let i = 1; i < clientsLines.length; i++) {
      const parts = parseCsvLine(clientsLines[i]);
      const idSociete = (parts[clientsIdSocieteIndex] || '').trim();
      const email = (parts[clientsEmailIndex] || '').trim().toLowerCase();
      const firstName = (parts[clientsFirstNameIndex] || '').trim();
      const lastName = (parts[clientsLastNameIndex] || '').trim();
      const idContact = (parts[clientsIdContactIndex] || '').trim();

      if (!idSociete) {
        noIdSociete++;
        continue;
      }

      // Trouver le contact en base (priorité: email > externalRef > nom)
      let contact = email ? contactsMapByEmail.get(email) : null;
      if (!contact && idContact) {
        contact = contactsMapByExternalRef.get(idContact);
      }
      if (!contact && firstName && lastName) {
        const nameKey = `${firstName.toLowerCase().trim()}|${lastName.toLowerCase().trim()}`;
        contact = contactsMapByName.get(nameKey);
      }

      if (!contact) {
        noContact++;
        continue;
      }

      // Trouver la company correspondante
      const companyId = companiesMap.get(idSociete);
      if (!companyId) {
        notFound++;
        continue;
      }

      // Vérifier si déjà correct
      const existing = await prisma.contact.findUnique({
        where: { id: contact.id },
        select: { companyId: true }
      });

      if (existing?.companyId === companyId) {
        alreadyCorrect++;
        continue;
      }

      // Corriger
      await prisma.contact.update({
        where: { id: contact.id },
        data: { companyId }
      });

      corrected++;
      if (corrected % 100 === 0) {
        // eslint-disable-next-line no-console
        console.log(`  ✅ ${corrected} contacts corrigés...`);
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(`\n📊 RÉSUMÉ:`);
  // eslint-disable-next-line no-console
  console.log(`  ✅ Contacts corrigés: ${corrected}`);
  // eslint-disable-next-line no-console
  console.log(`  ✓ Déjà corrects: ${alreadyCorrect}`);
  // eslint-disable-next-line no-console
  console.log(`  ⚠️  Contacts non trouvés en base: ${noContact}`);
  // eslint-disable-next-line no-console
  console.log(`  ⚠️  "Id de la société" vide dans CSV: ${noIdSociete}`);
  // eslint-disable-next-line no-console
  console.log(`  ⚠️  Company non trouvée pour "Id de la société": ${notFound}`);
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

