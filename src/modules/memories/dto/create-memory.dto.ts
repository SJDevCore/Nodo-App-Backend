import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Datos que acompañan a la foto. Llegan como multipart/form-data,
 * donde todo es texto: @Type convierte lat y lng a número antes de validar.
 */
export class CreateMemoryDto {
  @ApiPropertyOptional({ example: 'Mirador de Silvania', maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40, { message: 'El título no puede pasar de 40 caracteres' })
  title?: string;

  @ApiPropertyOptional({ example: 4.711 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'La latitud debe ser un número' })
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ example: -74.0721 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'La longitud debe ser un número' })
  @Min(-180)
  @Max(180)
  lng?: number;
}
