import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { ImportStatus } from '@prisma/client';
import { ContactsService } from '../contacts/contacts.service';

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contacts: ContactsService,
    private readonly audit: AuditService
  ) {}

  async importCsv(filename: string, csv: string) {
    const job = await this.prisma.importJob.create({
      data: { filename, status: ImportStatus.PROCESSING }
    });
    try {
      const rows = this.parseCsv(csv);
      for (const row of rows) {
        await this.contacts.create({
          firstName: row.firstName ?? 'Unknown',
          lastName: row.lastName,
          email: row.email,
          phone: row.phone
        });
      }
      await this.prisma.importJob.update({
        where: { id: job.id },
        data: { status: ImportStatus.COMPLETED }
      });
      await this.audit.log('import', job.id, 'completed');
      return { imported: rows.length };
    } catch (error) {
      await this.prisma.importJob.update({
        where: { id: job.id },
        data: { status: ImportStatus.FAILED }
      });
      throw error;
    }
  }

  async importAxonaut(params: {
    filenameClients: string;
    filenameContacts: string;
    clientsCsv: string;
    contactsCsv: string;
    dryRun: boolean;
  }) {
    const job = await this.prisma.importJob.create({
      data: { filename: `${params.filenameClients} + ${params.filenameContacts}`, status: ImportStatus.PROCESSING }
    });
    const report = { createdCompanies: 0, updatedCompanies: 0, createdContacts: 0, updatedContacts: 0, skippedContacts: 0, errors: [] as string[] };
    try {
      const clientsRows = this.parseCsvSemicolon(params.clientsCsv);
      const contactsRows = this.parseCsvSemicolon(params.contactsCsv);

      // Index by headers (French labels)
      const headerVal = (row: Record<string, string>, key: string) => (row[key] ?? '').trim();

      // First pass: companies from clients file
      for (const row of clientsRows) {
        const ownerHint = headerVal(row, 'Commercial responsable');
        const ownerId = await this.resolveOwnerId(ownerHint);
        const companyData = {
          externalRef: headerVal(row, 'Id de la société') || undefined,
          name: headerVal(row, 'Société') || 'Inconnu',
          isIndividual: headerVal(row, 'Est un particulier') === 'Oui',
          addressStreet: headerVal(row, 'Rue') || undefined,
          addressZip: headerVal(row, 'Code postal') || undefined,
          addressCity: headerVal(row, 'Ville') || undefined,
          addressCountry: headerVal(row, 'Pays') || undefined,
          siret: this.cleanSiret(headerVal(row, 'Siret')),
          iban: this.nullIfEmpty(headerVal(row, 'IBAN')),
          bic: this.nullIfEmpty(headerVal(row, 'BIC')),
          rum: this.nullIfEmpty(headerVal(row, 'RUM')),
          sepaMandateActive: this.toBoolean(headerVal(row, 'Mandat d\'autorisation de prélèvement actif')),
          vatNumber: this.nullIfEmpty(headerVal(row, 'TVA intracommunautaire')),
          legacyCode: this.nullIfEmpty(headerVal(row, 'Code tiers')),
          locale: this.nullIfEmpty(headerVal(row, 'Langue')),
          notes: this.nullIfEmpty(headerVal(row, 'Commentaires')),
          tags: this.mergeTags(headerVal(row, 'Catégories'), headerVal(row, 'Liste')),
          ownerId,
          linkedinUrl: this.normalizeUrl(this.nullIfEmpty(headerVal(row, 'Linkedin'))),
          salesNavigatorUrl: this.normalizeUrl(this.nullIfEmpty(headerVal(row, 'Salesnavigator'))),
          firstInvoiceDate: this.toDate(headerVal(row, 'firstInvoiceDate')),
          lastInvoiceDate: this.toDate(headerVal(row, 'lastInvoiceDate')),
          turnoverAllTime: this.toDecimalString(headerVal(row, 'turnover')),
          turnoverThisYear: this.toDecimalString(headerVal(row, 'turnoverThisYear')),
          lastActivityAt: this.toDate(headerVal(row, 'lastEvent')),
          nextActivityAt: this.toDate(headerVal(row, 'nextEvent')),
          statusClient: headerVal(row, 'Statut Client') === 'Oui',
          statusProspect: headerVal(row, 'Statut Prospect') === 'Oui',
          statusSupplier: headerVal(row, 'Statut Fournisseur') === 'Oui'
        } as any;

        if (!params.dryRun) {
          const { created, id: companyId } = await this.upsertCompany(companyData);
          // Option: créer activités synthétiques
          if (companyData.lastActivityAt) {
            await this.prisma.activity.create({
              data: {
                type: 'EVENT' as any,
                subject: 'Dernière activité (Axonaut)',
                description: undefined,
                dueDate: companyData.lastActivityAt
              }
            });
          }
          if (companyData.nextActivityAt) {
            await this.prisma.activity.create({
              data: {
                type: 'TASK' as any,
                subject: 'Prochaine activité (Axonaut)',
                description: undefined,
                dueDate: companyData.nextActivityAt
              }
            });
          }
          if (created) report.createdCompanies++; else report.updatedCompanies++;
        }
      }

      // Contacts embedded in clients file
      for (const row of clientsRows) {
        const contactData = {
          externalRef: this.nullIfEmpty(headerVal(row, 'Id du contact')),
          firstName: headerVal(row, 'Prénom du contact') || 'Inconnu',
          lastName: this.nullIfEmpty(headerVal(row, 'Nom du contact')),
          email: this.nullIfEmpty(headerVal(row, 'Email du contact')),
          phone: this.normalizePhone(this.nullIfEmpty(headerVal(row, 'Téléphone fixe'))),
          mobilePhone: this.normalizePhone(this.nullIfEmpty(headerVal(row, 'Téléphone portable')))
        } as any;

        const companyKey = {
          siret: this.cleanSiret(headerVal(row, 'Siret')),
          externalRef: this.nullIfEmpty(headerVal(row, 'Id de la société')),
          name: headerVal(row, 'Société'),
          zip: headerVal(row, 'Code postal'),
          city: headerVal(row, 'Ville')
        };

        if (!params.dryRun) {
          const result = await this.upsertContact(contactData, companyKey);
          if (result.skipped) {
            report.skippedContacts++;
          } else if (result.created) {
            report.createdContacts++;
          } else {
            report.updatedContacts++;
          }
        }
      }

      // Contacts file rows
      for (const row of contactsRows) {
        const contactData = {
          externalRef: this.nullIfEmpty(headerVal(row, 'Id du contact')),
          title: this.nullIfEmpty(headerVal(row, 'Civilité du contact')),
          firstName: headerVal(row, 'Prénom du contact') || 'Inconnu',
          lastName: this.nullIfEmpty(headerVal(row, 'Nom du contact')),
          email: this.nullIfEmpty(headerVal(row, 'Email du contact')),
          phone: this.normalizePhone(this.nullIfEmpty(headerVal(row, 'Téléphone fixe'))),
          mobilePhone: this.normalizePhone(this.nullIfEmpty(headerVal(row, 'Téléphone portable'))),
          jobTitle: this.nullIfEmpty(headerVal(row, 'Poste/Job du contact')),
          industry: this.nullIfEmpty(headerVal(row, "Secteur d'activité")),
          linkedinUrl: this.normalizeUrl(this.nullIfEmpty(headerVal(row, 'Profil LinkedIn'))),
          funnelStep: this.nullIfEmpty(headerVal(row, 'funnelStep'))
        } as any;

        const companyKey = {
          siret: this.cleanSiret(headerVal(row, 'Siret')),
          externalRef: this.nullIfEmpty(headerVal(row, 'Id de la société')),
          name: headerVal(row, 'Société'),
          zip: headerVal(row, 'Code postal'),
          city: headerVal(row, 'Ville')
        };

        if (!params.dryRun) {
          const result = await this.upsertContact(contactData, companyKey);
          if (result.skipped) {
            report.skippedContacts++;
          } else if (result.created) {
            report.createdContacts++;
          } else {
            report.updatedContacts++;
          }
        }
      }

      await this.prisma.importJob.update({ where: { id: job.id }, data: { status: ImportStatus.COMPLETED } });
      await this.audit.log('import', job.id, 'completed');
      return { jobId: job.id, dryRun: params.dryRun, ...report };
    } catch (error: any) {
      await this.prisma.importJob.update({ where: { id: job.id }, data: { status: ImportStatus.FAILED } });
      report.errors.push(error?.message ?? String(error));
      return { jobId: job.id, dryRun: params.dryRun, ...report };
    }
  }

  async importAxonautFromServerFiles(dryRun: boolean) {
    const baseDir = path.resolve(process.cwd(), '..', 'BDD_archives');
    const filenameClients = 'Save_clients_Axonaut.csv';
    const filenameContacts = 'Save_contacts_Axonaut.csv';
    const clientsPath = path.join(baseDir, filenameClients);
    const contactsPath = path.join(baseDir, filenameContacts);
    const [clientsCsvBuf, contactsCsvBuf] = await Promise.all([
      fs.readFile(clientsPath),
      fs.readFile(contactsPath)
    ]);
    const clientsCsv = clientsCsvBuf.toString('utf8');
    const contactsCsv = contactsCsvBuf.toString('utf8');
    return this.importAxonaut({
      filenameClients,
      filenameContacts,
      clientsCsv,
      contactsCsv,
      dryRun
    });
  }

  private async upsertCompany(data: any): Promise<{ created: boolean; id: string }> {
    // Priority: siret -> externalRef -> name+zip+city
    const incomingTags: string[] | undefined = data.tags as string[] | undefined;
    delete data.tags;
    const whereSiret = data.siret ? { siret: data.siret } : undefined;
    const existingBySiret = whereSiret ? await this.prisma.company.findFirst({ where: whereSiret }) : null;
    if (existingBySiret) {
      await this.prisma.company.update({ where: { id: existingBySiret.id }, data: this.mergeCompany(existingBySiret.id, data) });
      if (incomingTags?.length) await this.applyCompanyTags(existingBySiret.id, incomingTags);
      return { created: false, id: existingBySiret.id };
    }

    if (data.externalRef) {
      const existingByExt = await this.prisma.company.findFirst({ where: { externalRef: data.externalRef } });
      if (existingByExt) {
        await this.prisma.company.update({ where: { id: existingByExt.id }, data: this.mergeCompany(existingByExt.id, data) });
        if (incomingTags?.length) await this.applyCompanyTags(existingByExt.id, incomingTags);
        return { created: false, id: existingByExt.id };
      }
    }

    const name = (data.name ?? '').trim();
    const zip = (data.addressZip ?? '').trim();
    const city = (data.addressCity ?? '').trim();
    const existingByTriplet = name && (await this.prisma.company.findFirst({ where: { name, addressZip: zip || undefined, addressCity: city || undefined } }));
    if (existingByTriplet) {
      await this.prisma.company.update({ where: { id: existingByTriplet.id }, data: this.mergeCompany(existingByTriplet.id, data) });
      if (incomingTags?.length) await this.applyCompanyTags(existingByTriplet.id, incomingTags);
      return { created: false, id: existingByTriplet.id };
    }

    const created = await this.prisma.company.create({ data });
    if (incomingTags?.length) await this.applyCompanyTags(created.id, incomingTags);
    return { created: true, id: created.id };
  }

  private mergeCompany(_id: string, incoming: any) {
    // Non destructif: conserver owner si déjà présent; tags gérés via relation
    const { ownerId, ...rest } = incoming;
    return {
      ...rest
    } as any;
  }

  private async applyCompanyTags(companyId: string, tagNames: string[]) {
    const names = Array.from(new Set(tagNames.map((t) => this.unquote(t).trim()).filter((t) => t.length > 0)));
    if (names.length === 0) return;
    // Upsert tags by name and connect
    for (const name of names) {
      const tag = await this.prisma.tag.upsert({
        where: { name },
        update: {},
        create: { name }
      });
      // Connect if missing
      await this.prisma.company.update({
        where: { id: companyId },
        data: { tags: { connect: { id: tag.id } } }
      });
    }
  }

  private async upsertContact(data: any, companyKey: { siret?: string | null; externalRef?: string | null; name?: string; zip?: string; city?: string }) {
    // Ignore contacts vides (pas de firstName, email, externalRef)
    if (!data.firstName && !data.email && !data.externalRef) {
      return { created: false, id: '', skipped: true };
    }

    // Find company id first - STRICT: uniquement via externalRef ("Id de la société")
    // Pas de fallback SIRET/triplet pour éviter les mauvaises associations
    // Si "Id de la société" ne correspond à aucune company → companyId = null (contact orphelin)
    const companyId = await this.resolveCompanyIdForContact(companyKey.externalRef);

    // Contact keys: email -> externalRef -> name+company
    if (data.email) {
      const existingEmail = await this.prisma.contact.findFirst({ where: { email: data.email } });
      if (existingEmail) {
        await this.prisma.contact.update({ 
          where: { id: existingEmail.id }, 
          data: { ...data, companyId: companyId ?? existingEmail.companyId } 
        });
        return { created: false, id: existingEmail.id };
      }
    }
    if (data.externalRef) {
      const existingExt = await this.prisma.contact.findFirst({ where: { externalRef: data.externalRef } });
      if (existingExt) {
        await this.prisma.contact.update({ 
          where: { id: existingExt.id }, 
          data: { ...data, companyId: companyId ?? existingExt.companyId } 
        });
        return { created: false, id: existingExt.id };
      }
    }
    
    // Fallback anti-doublon: (firstName, lastName, companyId)
    const firstName = (data.firstName ?? '').trim();
    const lastName = (data.lastName ?? '').trim();
    if (companyId && firstName) {
      const existingByTriplet = await this.prisma.contact.findFirst({
        where: { firstName, lastName: lastName || null, companyId }
      });
      if (existingByTriplet) {
        await this.prisma.contact.update({
          where: { id: existingByTriplet.id },
          data: { ...data, companyId }
        });
        return { created: false, id: existingByTriplet.id };
      }
    }

    // Créer même sans email/externalRef si on a des infos minimales
    if (!data.firstName) data.firstName = 'Inconnu';
    const created = await this.prisma.contact.create({ data: { ...data, companyId: companyId ?? undefined } });
    return { created: true, id: created.id };
  }

  // Résolution STRICTE pour contacts : uniquement via externalRef ("Id de la société")
  // Pas de fallback pour éviter les mauvaises associations
  private async resolveCompanyIdForContact(externalRef: string | null | undefined): Promise<string | undefined> {
    if (!externalRef) return undefined;
    const trimmed = externalRef.trim();
    if (!trimmed) return undefined;
    const c = await this.prisma.company.findFirst({ where: { externalRef: trimmed } });
    return c?.id;
  }

  // Résolution pour companies (upsert) : SIRET > externalRef > triplet
  private async resolveCompanyId(key: { siret?: string | null; externalRef?: string | null; name?: string; zip?: string; city?: string }) {
    // Priorité: SIRET > externalRef > triplet (nom+zip+city)
    // Pour les companies, on utilise SIRET en priorité car plus fiable
    if (key.siret) {
      const c = await this.prisma.company.findFirst({ where: { siret: key.siret } });
      if (c) return c.id;
    }
    if (key.externalRef) {
      const trimmed = key.externalRef.trim();
      if (trimmed) {
        const c = await this.prisma.company.findFirst({ where: { externalRef: trimmed } });
      if (c) return c.id;
      }
    }
    const name = (key.name ?? '').trim();
    const zip = (key.zip ?? '').trim();
    const city = (key.city ?? '').trim();
    if (name) {
      const c = await this.prisma.company.findFirst({ where: { name, addressZip: zip || undefined, addressCity: city || undefined } });
      if (c) return c.id;
    }
    return undefined;
  }

  private parseCsvSemicolon(csv: string): Array<Record<string, string>> {
    const lines = csv.split(/\r?\n/).filter((l) => l.length > 0);
    if (lines.length === 0) return [];
    const headers = this.splitSemicolonLine(lines[0]).map((h) => this.unquote(h).trim());
    const rows: Array<Record<string, string>> = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = this.splitSemicolonLine(lines[i]).map((v) => this.unquote(v));
      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) row[headers[j]] = parts[j] ?? '';
      rows.push(row);
    }
    return rows;
  }

  private splitSemicolonLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        current += ch;
      } else if (ch === ';' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }

  

  private unquote(s: string) {
    const t = s.trim();
    if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).replace(/""/g, '"');
    if (t === '""""""') return '';
    return t;
  }

  private toDate(d: string): Date | undefined {
    const t = d.trim();
    if (!t) return undefined;
    // jj/mm/aaaa
    const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      const [_, jj, mm, aaaa] = m;
      return new Date(Number(aaaa), Number(mm) - 1, Number(jj));
    }
    const parsed = new Date(t);
    return isNaN(parsed.valueOf()) ? undefined : parsed;
  }

  private toDecimalString(frNumber: string): string | undefined {
    const t = frNumber.trim();
    if (!t) return undefined;
    return t.replace(/\./g, '').replace(/,/g, '.');
  }

  private mergeTags(a?: string, b?: string): string[] | undefined {
    const input = [a ?? '', b ?? '']
      .map((s) => (s || '').trim())
      .filter((s) => s.length > 0);
    if (input.length === 0) return undefined;
    const raw = input
      .flatMap((s) =>
        s
          .split(/\||,|;|\//g)
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      );
    const seen = new Set<string>();
    const result: string[] = [];
    for (const t of raw) {
      const key = t.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(t);
      }
    }
    return result.length > 0 ? result : undefined;
  }

  private toBoolean(v: string): boolean | undefined {
    const t = v.trim();
    if (!t) return undefined;
    return t === 'Oui' || t.toLowerCase() === 'true';
  }

  private async resolveOwnerId(hint: string): Promise<string | undefined> {
    const v = (hint || '').trim();
    if (!v) return undefined;
    // Only resolve by exact email for now
    const emailMatch = v.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const email = emailMatch ? emailMatch[0] : undefined;
    if (!email) return undefined;
    const user = await this.prisma.user.findFirst({ where: { email } });
    return user?.id ?? undefined;
  }

  private cleanSiret(s: string): string | undefined {
    const t = s.replace(/\s+/g, '').replace(/[^0-9]/g, '');
    return t.length ? t : undefined;
  }

  private nullIfEmpty(v: string): string | undefined {
    const t = v.trim();
    return t ? t : undefined;
  }

  private parseCsv(csv: string): Array<Record<string, string>> {
    const [headerLine, ...lines] = csv.split(/\r?\n/).filter(Boolean);
    const headers = headerLine.split(',').map((h) => h.trim());
    return lines.map((line) => {
      const values = line.split(',').map((v) => v.trim());
      return headers.reduce<Record<string, string>>((acc, header, index) => {
        acc[header] = values[index] ?? '';
        return acc;
      }, {});
    });
  }

  private normalizePhone(v?: string): string | undefined {
    if (!v) return undefined;
    const trimmed = v.trim();
    if (!trimmed) return undefined;
    // Keep leading +, strip other non-digits
    const hasPlus = trimmed.startsWith('+');
    const digits = trimmed.replace(/[^0-9]/g, '');
    if (!digits) return undefined;
    return (hasPlus ? '+' : '') + digits;
  }

  private normalizeUrl(v?: string): string | undefined {
    if (!v) return undefined;
    const s = v.trim();
    if (!s) return undefined;
    const prefixed = /^(https?:)?\/\//i.test(s) ? s : `https://${s}`;
    try {
      const u = new URL(prefixed);
      return u.toString();
    } catch {
      return undefined;
    }
  }
}
