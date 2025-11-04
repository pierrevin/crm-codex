import * as fs from 'fs/promises';
import * as path from 'path';

async function main() {
  const baseDir = path.resolve(process.cwd(), '..', 'BDD_archives');
  const contactsPath = path.join(baseDir, 'Save_contacts_Axonaut.csv');
  const clientsPath = path.join(baseDir, 'Save_clients_Axonaut.csv');

  const contactsCsv = await fs.readFile(contactsPath, 'utf8');
  const clientsCsv = await fs.readFile(clientsPath, 'utf8');

  // Parse simple
  const parseCsv = (csv: string) => {
    const lines = csv.split(/\r?\n/).filter((l) => l.length > 0);
    if (lines.length === 0) return [];
    const headers = lines[0].split(';').map((h) => h.trim().replace(/^"|"$/g, ''));
    const rows: Array<Record<string, string>> = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(';').map((p) => p.trim().replace(/^"|"$/g, ''));
      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = parts[j] ?? '';
      }
      rows.push(row);
    }
    return rows;
  };

  const contactsRows = parseCsv(contactsCsv);
  const clientsRows = parseCsv(clientsCsv);

  // Vérifier les colonnes disponibles
  // eslint-disable-next-line no-console
  console.log('\n=== COLONNES DISPONIBLES DANS CONTACTS ===');
  if (contactsRows.length > 0) {
    // eslint-disable-next-line no-console
    console.log(Object.keys(contactsRows[0]).filter((k) => k.toLowerCase().includes('id') || k.toLowerCase().includes('société')));
  }

  // eslint-disable-next-line no-console
  console.log('\n=== COLONNES DISPONIBLES DANS CLIENTS ===');
  if (clientsRows.length > 0) {
    // eslint-disable-next-line no-console
    console.log(Object.keys(clientsRows[0]).filter((k) => k.toLowerCase().includes('id') || k.toLowerCase().includes('société')));
  }

  // Vérifier si "Id de la société" existe dans contacts
  const sampleContact = contactsRows[0];
  // eslint-disable-next-line no-console
  console.log('\n=== EXEMPLE CONTACT (premier) ===');
  // eslint-disable-next-line no-console
  console.log('Id du contact:', sampleContact['Id du contact']);
  // eslint-disable-next-line no-console
  console.log('Id de la société:', sampleContact['Id de la société']);
  // eslint-disable-next-line no-console
  console.log('Société:', sampleContact['Société']);

  // Vérifier si "Id de la société" existe dans clients
  const sampleClient = clientsRows[0];
  // eslint-disable-next-line no-console
  console.log('\n=== EXEMPLE CLIENT (premier) ===');
  // eslint-disable-next-line no-console
  console.log('Id de la société:', sampleClient['Id de la société']);
  // eslint-disable-next-line no-console
  console.log('Société:', sampleClient['Société']);

  // Compter les contacts avec/sans "Id de la société"
  const contactsWithIdSociete = contactsRows.filter((r) => r['Id de la société'] && r['Id de la société'].trim() !== '').length;
  const contactsWithoutIdSociete = contactsRows.length - contactsWithIdSociete;

  // eslint-disable-next-line no-console
  console.log(`\nContacts avec "Id de la société": ${contactsWithIdSociete}`);
  // eslint-disable-next-line no-console
  console.log(`Contacts sans "Id de la société": ${contactsWithoutIdSociete}`);

  // Extraire les valeurs uniques de "Id de la société" dans contacts et clients
  const contactIds = new Set(contactsRows.map((r) => r['Id de la société']).filter(Boolean));
  const clientIds = new Set(clientsRows.map((r) => r['Id de la société']).filter(Boolean));

  // eslint-disable-next-line no-console
  console.log(`\nValeurs uniques "Id de la société" dans contacts: ${contactIds.size}`);
  // eslint-disable-next-line no-console
  console.log(`Valeurs uniques "Id de la société" dans clients: ${clientIds.size}`);

  // Vérifier la correspondance
  const matchingIds = Array.from(contactIds).filter((id) => clientIds.has(id));
  // eslint-disable-next-line no-console
  console.log(`Ids qui matchent entre contacts et clients: ${matchingIds.length}`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

