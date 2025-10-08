import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ContactsService } from './contacts.service';

@ApiTags('contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false })
  list(
    @Query('search') search?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit = '20'
  ) {
    return this.contacts.list(search, cursor, Number(limit));
  }

  @Post()
  create(@Body() dto: CreateContactDto) {
    return this.contacts.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contacts.update(id, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contacts.findOne(id);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.contacts.delete(id);
  }
}
