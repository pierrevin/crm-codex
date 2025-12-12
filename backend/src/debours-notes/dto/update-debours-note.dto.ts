
import { PartialType } from '@nestjs/mapped-types';
import { CreateDeboursNoteDto } from './create-debours-note.dto';

export class UpdateDeboursNoteDto extends PartialType(CreateDeboursNoteDto) {
  // invoiceNumber est déjà inclus via PartialType de CreateDeboursNoteDto
}

