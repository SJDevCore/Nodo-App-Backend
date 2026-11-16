import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Trip } from '../../trips/schemas/trip.schema';
import { User } from '../../users/schemas/user.schema';

export type PositionDocument = HydratedDocument<Position>;

/** Cuánto se conserva una posición sin actualizarse antes de que Mongo la borre sola. */
const KEEP_SECONDS = 7 * 24 * 60 * 60; // 7 días

/**
 * Última posición conocida de un integrante en un viaje.
 * Hay UN documento por integrante y viaje: se sobrescribe, no se acumula.
 * No es un historial de recorrido; es el respaldo de lo que el gateway tiene en memoria.
 */
@Schema({ versionKey: false })
export class Position {
  @Prop({ type: Types.ObjectId, ref: Trip.name, required: true })
  trip!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: -90, max: 90 })
  lat!: number;

  @Prop({ type: Number, required: true, min: -180, max: 180 })
  lng!: number;

  @Prop({ type: Number, default: null })
  heading!: number | null;

  @Prop({ type: Number, default: null })
  speed!: number | null;

  /** Momento en que el servidor recibió la posición. */
  @Prop({ type: Date, required: true })
  at!: Date;
}

export const PositionSchema = SchemaFactory.createForClass(Position);

// Garantiza un solo documento por integrante y viaje, y hace rápido el upsert.
PositionSchema.index({ trip: 1, user: 1 }, { unique: true });

// Índice TTL: Mongo elimina solo los documentos cuya fecha "at" tenga más de 7 días.
// Así las posiciones de viajes viejos no se quedan ocupando espacio.
PositionSchema.index({ at: 1 }, { expireAfterSeconds: KEEP_SECONDS });
