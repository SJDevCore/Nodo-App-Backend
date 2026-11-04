import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LocationDocument = HydratedDocument<Location>;

/**
 * Punto GeoJSON almacenado en Mongo.
 * CONVENCIÓN GeoJSON: coordinates es [lng, lat] (longitud primero, luego latitud).
 * Es fácil de invertir; respetar SIEMPRE ese orden al leer y escribir.
 */
@Schema({ _id: false })
export class GeoPoint {
  @Prop({ type: String, enum: ['Point'], required: true, default: 'Point' })
  type: 'Point';

  // [lng, lat] — longitud en [-180, 180], latitud en [-90, 90]
  @Prop({ type: [Number], required: true })
  coordinates: number[];
}

export const GeoPointSchema = SchemaFactory.createForClass(GeoPoint);

/**
 * Última ubicación conocida de un usuario (una por usuario).
 * timestamps.updatedAt refleja cuándo se actualizó la posición por última vez.
 * versionKey: false → elimina el campo interno __v.
 */
@Schema({ timestamps: { createdAt: false, updatedAt: true }, versionKey: false })
export class Location {
  // Una ubicación por usuario: el índice único lo garantiza en la base
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: GeoPointSchema, required: true })
  point: GeoPoint;

  // Precisión reportada por el dispositivo (metros), opcional
  @Prop({ type: Number })
  accuracy?: number;

  // Nivel de batería del dispositivo (0..100), opcional
  @Prop({ type: Number })
  battery?: number;
}

export const LocationSchema = SchemaFactory.createForClass(Location);

/**
 * Índice geoespacial 2dsphere sobre point: habilita consultas geoespaciales
 * (cercanía, dentro de un área) sobre coordenadas GeoJSON.
 */
LocationSchema.index({ point: '2dsphere' });
