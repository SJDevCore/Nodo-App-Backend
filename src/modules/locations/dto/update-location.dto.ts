import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

/**
 * Datos para registrar la ubicación del usuario autenticado.
 *
 * OJO con la convención GeoJSON: el punto se guarda como coordinates [lng, lat]
 * (longitud primero, latitud después). Aquí lng y lat llegan por separado para
 * evitar confusiones; el servicio los compone en ese orden.
 *
 * El ValidationPipe global rechaza con 400 cualquier campo extra o fuera de rango.
 */
export class UpdateLocationDto {
  @ApiProperty({ example: -74.08175, description: 'Longitud (-180 a 180)' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiProperty({ example: 4.60971, description: 'Latitud (-90 a 90)' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiPropertyOptional({ example: 12.5, description: 'Precisión en metros' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;

  @ApiPropertyOptional({ example: 84, description: 'Batería del dispositivo (0 a 100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  battery?: number;
}
