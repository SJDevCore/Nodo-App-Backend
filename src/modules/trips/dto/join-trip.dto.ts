import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString, Matches } from 'class-validator';
import {
  TRIP_CODE_ALPHABET,
  VEHICLES,
  type Vehicle,
} from '../schemas/trip.schema';

/** Datos para unirse a un viaje existente con su código de invitación. */
export class JoinTripDto {
  /**
   * Se convierte a mayúsculas ANTES de validar, para aceptar "abc234".
   * Solo admite el alfabeto sin caracteres confusos (sin 0, O, 1, I ni L).
   * La regex se arma con new RegExp para usar la constante TRIP_CODE_ALPHABET.
   */
  @ApiProperty({ example: 'ABC234' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString({ message: 'El código debe ser un texto' })
  @Matches(new RegExp(`^[${TRIP_CODE_ALPHABET}]{6}$`), {
    message: 'El código debe tener 6 caracteres válidos (sin 0, O, 1, I ni L)',
  })
  code!: string;

  @ApiProperty({ enum: VEHICLES })
  @IsIn(VEHICLES, {
    message: `El vehículo debe ser uno de: ${VEHICLES.join(', ')}`,
  })
  vehicle!: Vehicle;
}
