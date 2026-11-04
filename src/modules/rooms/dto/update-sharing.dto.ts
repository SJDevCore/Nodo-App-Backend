import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/**
 * Pausar (false) o reanudar (true) el compartir del usuario en una sala.
 */
export class UpdateSharingDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  sharing: boolean;
}
