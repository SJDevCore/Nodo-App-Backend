import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

/**
 * Datos para unirse a una sala con su código de invitación.
 */
export class JoinRoomDto {
  @ApiProperty({ example: 'K7M2PQ', description: 'Código de 6 caracteres' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string;
}
