import { Injectable } from '@nestjs/common';

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
}
