import { Module } from '@nestjs/common';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { DocumentAiService } from './ocr/document-ai.service';
import { ExpenseParserService } from './ocr/expense-parser.service';
import { SupabaseStorageService } from './storage/supabase-storage.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ExpensesController],
  providers: [
    ExpensesService,
    DocumentAiService,
    ExpenseParserService,
    SupabaseStorageService
  ],
  exports: [ExpensesService]
})
export class ExpensesModule {}

