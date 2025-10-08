import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';

import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly webhooks: WebhooksService
  ) {}

  async list(search: string | undefined, cursor: string | undefined, limit: number) {
    const contacts = await this.prisma.contact.findMany({
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      where: search
        ? {
            OR: [
              { firstName: { contains: search } },
              { lastName: { contains: search } },
              { email: { contains: search } }
            ]
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      include: { company: true }
    });
    const nextCursor = contacts.length === limit ? contacts[contacts.length - 1].id : null;
    return { data: contacts, nextCursor };
  }

  async create(dto: CreateContactDto) {
    const contact = await this.prisma.contact.create({ data: dto });
    await this.audit.log('contact', contact.id, 'created');
    await this.webhooks.trigger('contact.created', contact);
    return contact;
  }

  async update(id: string, dto: UpdateContactDto) {
    const contact = await this.prisma.contact.update({ where: { id }, data: dto });
    await this.audit.log('contact', id, 'updated');
    await this.webhooks.trigger('contact.updated', contact);
    return contact;
  }

  async findOne(id: string) {
    const contact = await this.prisma.contact.findUnique({ where: { id }, include: { company: true } });
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }
    return contact;
  }

  async delete(id: string) {
    const contact = await this.prisma.contact.findUnique({ where: { id } });
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }
    await this.prisma.contact.delete({ where: { id } });
    await this.audit.log('contact', id, 'deleted');
    return { message: 'Contact deleted successfully' };
  }
}
