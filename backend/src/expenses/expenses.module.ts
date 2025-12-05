import { Module } from '@nestjs/common';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { RecurringExpensesController } from './recurring-expenses.controller';
import { RecurringExpensesService } from './recurring-expenses.service';
import { DocumentAiService } from './ocr/document-ai.service';
import { ExpenseParserService } from './ocr/expense-parser.service';
import { SupabaseStorageService } from './storage/supabase-storage.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ExpensesController, RecurringExpensesController],
  providers: [
    ExpensesService,
    RecurringExpensesService,
    DocumentAiService,
    ExpenseParserService,
    SupabaseStorageService
  ],
  exports: [ExpensesService, RecurringExpensesService]
})
export class ExpensesModule {}

