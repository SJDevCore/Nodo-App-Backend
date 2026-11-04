import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Datos para crear una sala.
 * El ValidationPipe global rechaza con 400 cualquier campo extra o inválido.
 */
export class CreateRoomDto {
  @ApiProperty({ example: 'Viaje a la playa' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;
}
