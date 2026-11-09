import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

/**
 * Vehículos permitidos. Fuente única: la usan el esquema, los DTO y Swagger.
 * as const → TypeScript trata el arreglo como esos textos exactos,
 * y así el tipo Vehicle se calcula solo.
 */
export const VEHICLES = ['car', 'motorcycle', 'bicycle'] as const;
export type Vehicle = (typeof VEHICLES)[number];

/** Estados de un viaje. */
export const TRIP_STATUSES = ['active', 'ended'] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];
/**
 * Caracteres del código de invitación. Sin 0, O, 1, I ni L porque se confunden
 * al dictarlos o leerlos. 31 caracteres en 6 posiciones ≈ 887 millones de códigos.
 * Lo usan el generador del service y la validación del JoinTripDto.
 */

export const TRIP_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// ─────────────────────────────────────────────────────────────
// Integrante
// ─────────────────────────────────────────────────────────────

/**
 * Integrante de un viaje.
 * Va como subdocumento DENTRO del viaje (no en otra colección) porque un viaje
 * tiene pocos integrantes (un grupo familiar o de amigos) y siempre se leen
 * junto con él: una sola consulta trae el viaje completo.
 * _id: false → se identifica por "user"; no necesita un id propio.
 */
@Schema({ _id: false })
export class Member {
  /** Solo guarda el id del usuario; con populate se obtiene su nombre. */
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user!: Types.ObjectId;

  /** Define el ícono con el que aparece en el mapa. */
  @Prop({ type: String, enum: VEHICLES, required: true })
  vehicle!: Vehicle;

  /** Date.now sin paréntesis: se evalúa al crear cada integrante, no al arrancar el servidor. */
  @Prop({ type: Date, default: Date.now })
  joinedAt!: Date;
}

export const MemberSchema = SchemaFactory.createForClass(Member);

// ─────────────────────────────────────────────────────────────
// Viaje
// ─────────────────────────────────────────────────────────────

export type TripDocument = HydratedDocument<Trip>;

/**
 * TODO: comentario de la clase (qué es un viaje y qué guarda)
 */
@Schema({ timestamps: true, versionKey: false })
export class Trip {
  /** Nombre del viaje. */
  @Prop({ type: String, required: true, trim: true, maxlength: 60 })
  name!: string;
  /** Destino del viaje. */
  @Prop({ type: String, trim: true, maxlength: 60 })
  destination?: string;
  /** Código del viaje. */
  @Prop({
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    minlength: 6,
    maxlength: 6,
  })
  code!: string;
  /** Id del usuario que creó el viaje. */
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  owner!: Types.ObjectId;
  /** Estado del viaje. */
  @Prop({ type: String, enum: TRIP_STATUSES, default: 'active' })
  status!: TripStatus;
  /** Integrantes del viaje. */
  @Prop({ type: [MemberSchema], default: [] })
  members!: Member[];
  /** Fecha de finalización del viaje. */
  @Prop({ type: Date })
  endedAt?: Date;
}

export const TripSchema = SchemaFactory.createForClass(Trip);

/**
 * Búsqueda principal: "el viaje activo donde participa este usuario"
 * (al unirse, al crear y al conectarse por socket). Indexa el usuario
 * dentro del arreglo de integrantes, no solo el creador.
 */
TripSchema.index({ 'members.user': 1, status: 1 });
