import { Injectable } from '@nestjs/common';

import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entity: string, entityId: string, action: string, userId?: string) {
    await this.prisma.auditLog.create({
      data: { entity, entityId, action, userId }
    });
  }
}
