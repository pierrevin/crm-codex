import { Module } from '@nestjs/common';
import { DeboursNotesService } from './debours-notes.service';
import { DeboursNotesController } from './debours-notes.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { GoogleModule } from '../google/google.module';

@Module({
  imports: [PrismaModule, GoogleModule],
  providers: [DeboursNotesService],
  controllers: [DeboursNotesController],
  exports: [DeboursNotesService]
})
export class DeboursNotesModule {}

