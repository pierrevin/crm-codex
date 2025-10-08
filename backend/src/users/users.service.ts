import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';

import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly config: ConfigService
  ) {}

  async onModuleInit() {
    const email = this.config.get<string>('ADMIN_EMAIL') ?? this.config.get('app.admin.email');
    const password = this.config.get<string>('ADMIN_PASSWORD') ?? this.config.get('app.admin.password');
    if (email && password) {
      await this.ensureAdmin(email, password);
    }
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async ensureAdmin(email: string, password: string) {
    const existing = await this.findByEmail(email);
    if (existing) {
      return existing;
    }
    const passwordHash = await argon2.hash(password);
    const user = await this.prisma.user.create({
      data: { email, passwordHash }
    });
    await this.auditService.log('user', user.id, 'created', user.id);
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const { password, ...rest } = dto;
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...rest,
        passwordHash: password ? await argon2.hash(password) : undefined
      }
    });
    await this.auditService.log('user', id, 'updated', id);
    return user;
  }

  async getById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
