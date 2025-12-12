import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DeboursNotesService } from './debours-notes.service';
import { CreateDeboursNoteDto, UpdateDeboursNoteDto } from './dto';
import { Request } from 'express';

@ApiTags('debours-notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/debours-notes')
export class DeboursNotesController {
  constructor(private readonly deboursNotesService: DeboursNotesService) {}

  @Post()
  create(@Body() dto: CreateDeboursNoteDto, @Req() req: Request) {
    const userId = (req as any).user?.id || (req as any).user?.sub;
    return this.deboursNotesService.create(dto, userId);
  }

  @Get()
  @ApiQuery({ name: 'opportunityId', required: false, type: String })
  @ApiQuery({ name: 'companyId', required: false, type: String })
  findAll(@Query('opportunityId') opportunityId?: string, @Query('companyId') companyId?: string) {
    return this.deboursNotesService.findAll({ opportunityId, companyId });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.deboursNotesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDeboursNoteDto) {
    return this.deboursNotesService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.deboursNotesService.delete(id);
  }

  @Post(':id/link-expenses')
  linkExpenses(@Param('id') id: string, @Body() body: { expenseIds: string[] }) {
    return this.deboursNotesService.linkExpenses(id, body.expenseIds);
  }

  @Post(':id/generate-doc')
  generateDoc(@Param('id') id: string, @Body() body: { templateId?: string }, @Req() req: Request) {
    const userId = (req as any).user?.id || (req as any).user?.sub;
    return this.deboursNotesService.generateFromGoogleDocs(id, userId, body.templateId);
  }
}

