import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../common/prisma/prisma.service';
import { ExpensesService } from './expenses.service';
import { RecurringExpensesService } from './recurring-expenses.service';
import { UpdateExpenseDto } from './dto';

@ApiTags('expenses')
@ApiBearerAuth()
@Controller('api/expenses')
export class ExpensesController {
  constructor(
    private readonly expensesService: ExpensesService,
    private readonly recurringExpensesService: RecurringExpensesService,
    private readonly prisma: PrismaService
  ) {}

  @Post('scan')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary'
        },
        accountCode: {
          type: 'string'
        }
      }
    }
  })
  async scanExpense(@Req() req: FastifyRequest) {
    // Récupérer userId depuis le token JWT (Supabase ou local)
    let userId = (req as any).user?.userId;
    
    // Si pas trouvé via le guard, décoder le token Supabase depuis le header
    if (!userId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          // Décoder le token JWT (base64, sans vérification de signature)
          const parts = token.split('.');
          if (parts.length === 3) {
            // Décoder le payload (base64url)
            const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(Buffer.from(base64, 'base64').toString());
            
            // Le token Supabase utilise userId dans le payload (voir supabase/functions/_shared/jwt.ts)
            // Format: { userId: string, exp: number }
            if (payload.userId) {
              userId = payload.userId;
            } else if (payload.sub) {
              userId = payload.sub;
            } else if (payload.id) {
              userId = payload.id;
            } else if (payload.email) {
              // Chercher l'utilisateur par email dans la base
              const user = await this.prisma.user.findUnique({
                where: { email: payload.email },
                select: { id: true }
              });
              if (user) {
                userId = user.id;
              }
            }
          }
        } catch (e) {
          console.error('Erreur décodage token:', e);
        }
      }
    }
    
    if (!userId) {
      throw new Error('User ID not found in request. Veuillez vous reconnecter.');
    }

    // Parcourir les parties du formulaire multipart
    interface FileData {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      buffer: Buffer;
      size: number;
    }

    let file: FileData | null = null;
    let accountCode: string | undefined;

    const parts = req.parts();
    for await (const part of parts) {
      if (part.type === 'file') {
        // Lire le fichier en buffer
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        // Créer un objet file
        file = {
          fieldname: part.fieldname,
          originalname: part.filename || 'unknown',
          encoding: '7bit',
          mimetype: part.mimetype || 'application/octet-stream',
          buffer: buffer,
          size: buffer.length
        };
      } else if (part.type === 'field' && part.fieldname === 'accountCode') {
        accountCode = part.value as string;
      }
    }

    if (!file) {
      throw new Error('File is required');
    }

    return this.expensesService.scanAndCreateExpense(file, userId, accountCode);
  }

  @Get()
  async findAll(
    @Query('userId') userId?: string,
    @Query('status') status?: string,
    @Query('companyId') companyId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Req() req?: FastifyRequest
  ) {
    // Récupérer userId depuis le token si non fourni en query
    if (!userId && req) {
      let tokenUserId = (req as any).user?.userId;
      
      if (!tokenUserId) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const parts = token.split('.');
            if (parts.length === 3) {
              const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
              const payload = JSON.parse(Buffer.from(base64, 'base64').toString());
              
              if (payload.userId) {
                tokenUserId = payload.userId;
              } else if (payload.sub) {
                tokenUserId = payload.sub;
              } else if (payload.id) {
                tokenUserId = payload.id;
              } else if (payload.email) {
                const user = await this.prisma.user.findUnique({
                  where: { email: payload.email },
                  select: { id: true }
                });
                if (user) {
                  tokenUserId = user.id;
                }
              }
            }
          } catch (e) {
            console.error('Erreur décodage token:', e);
          }
        }
      }
      
      if (tokenUserId) {
        userId = tokenUserId;
      }
    }
    const filters: any = {};
    if (status) filters.status = status;
    if (companyId) filters.companyId = companyId;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    return this.expensesService.findAll(userId, filters);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req?: FastifyRequest) {
    // Vérification basique de l'authentification (optionnel pour la lecture)
    // On laisse passer même sans token pour permettre la consultation
    return this.expensesService.findOne(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateExpenseDto, @Req() req: FastifyRequest) {
    // Récupérer userId depuis le token JWT (Supabase ou local)
    let userId = (req as any).user?.userId;
    
    // Si pas trouvé via le guard, décoder le token Supabase depuis le header
    if (!userId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          // Décoder le token JWT (base64, sans vérification de signature)
          const parts = token.split('.');
          if (parts.length === 3) {
            // Décoder le payload (base64url)
            const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(Buffer.from(base64, 'base64').toString());
            
            // Le token Supabase utilise userId dans le payload
            if (payload.userId) {
              userId = payload.userId;
            } else if (payload.sub) {
              userId = payload.sub;
            } else if (payload.id) {
              userId = payload.id;
            } else if (payload.email) {
              // Chercher l'utilisateur par email dans la base
              const user = await this.prisma.user.findUnique({
                where: { email: payload.email },
                select: { id: true }
              });
              if (user) {
                userId = user.id;
              }
            }
          }
        } catch (e) {
          console.error('Erreur décodage token:', e);
        }
      }
    }
    
    if (!userId) {
      throw new Error('User ID not found in request. Veuillez vous reconnecter.');
    }

    // Vérifier que l'utilisateur est propriétaire de la dépense
    const expense = await this.expensesService.findOne(id);
    if (!expense) {
      throw new Error('Dépense non trouvée.');
    }
    if (expense.userId && expense.userId !== userId) {
      throw new Error('Vous n\'êtes pas autorisé à modifier cette dépense.');
    }

    return this.expensesService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: FastifyRequest) {
    // Récupérer userId depuis le token JWT (Supabase ou local)
    let userId = (req as any).user?.userId;
    
    // Si pas trouvé via le guard, décoder le token Supabase depuis le header
    if (!userId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(Buffer.from(base64, 'base64').toString());
            
            if (payload.userId) {
              userId = payload.userId;
            } else if (payload.sub) {
              userId = payload.sub;
            } else if (payload.id) {
              userId = payload.id;
            } else if (payload.email) {
              const user = await this.prisma.user.findUnique({
                where: { email: payload.email },
                select: { id: true }
              });
              if (user) {
                userId = user.id;
              }
            }
          }
        } catch (e) {
          console.error('Erreur décodage token:', e);
        }
      }
    }
    
    if (!userId) {
      throw new Error('User ID not found in request. Veuillez vous reconnecter.');
    }

    // Vérifier que l'utilisateur est propriétaire de la dépense
    const expense = await this.expensesService.findOne(id);
    if (!expense) {
      throw new Error('Dépense non trouvée.');
    }
    if (expense.userId && expense.userId !== userId) {
      throw new Error('Vous n\'êtes pas autorisé à supprimer cette dépense.');
    }

    return this.expensesService.delete(id);
  }

  @Post(':id/validate')
  @UseGuards(JwtAuthGuard)
  async validateForecast(@Param('id') id: string) {
    return this.recurringExpensesService.validateForecastExpense(id);
  }
}

