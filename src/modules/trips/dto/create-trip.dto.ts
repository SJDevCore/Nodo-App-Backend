import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { VEHICLES, type Vehicle } from '../schemas/trip.schema';

/**
 * Datos para crear un viaje. Quien lo crea queda como dueño (owner)
 * y como primer integrante, con el vehículo que indique aquí.
 * Los límites coinciden con el esquema Trip.
 */
export class CreateTripDto {
  @ApiProperty({ example: 'Paseo a Melgar' })
  @IsString({ message: 'El nombre debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre del viaje es obligatorio' })
  @MaxLength(60, { message: 'El nombre puede tener máximo 60 caracteres' })
  name!: string;

  /** Opcional: si no viene, se saltan las demás reglas. Si viene, no puede estar vacío. */
  @ApiPropertyOptional({ example: 'Melgar, Tolima' })
  @IsOptional()
  @IsString({ message: 'El destino debe ser un texto' })
  @IsNotEmpty({ message: 'El destino no puede estar vacío' })
  @MaxLength(60, { message: 'El destino puede tener máximo 60 caracteres' })
  destination?: string;

  @ApiProperty({ enum: VEHICLES })
  @IsIn(VEHICLES, {
    message: `El vehículo debe ser uno de: ${VEHICLES.join(', ')}`,
  })
  vehicle!: Vehicle;
}
