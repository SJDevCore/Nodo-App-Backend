import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MemoryDocument = HydratedDocument<Memory>;

/**
 * Recuerdo: una foto con título y lugar.
 * La imagen NO se guarda aquí: vive en Cloudinary y en Mongo queda solo su URL.
 */
@Schema({ timestamps: true })
export class Memory {
  /** Quien tomó la foto. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  /** Viaje en el que se tomó; null si no había viaje activo. */
  @Prop({ type: Types.ObjectId, ref: 'Trip', default: null })
  trip: Types.ObjectId | null;

  @Prop({ required: true, trim: true, maxlength: 40 })
  title: string;

  @Prop({ required: true })
  imageUrl: string;

  /** Identificador en Cloudinary: se necesita para borrar la imagen. */
  @Prop({ required: true })
  publicId: string;

  @Prop({ type: Number, min: -90, max: 90, default: null })
  lat: number | null;

  @Prop({ type: Number, min: -180, max: 180, default: null })
  lng: number | null;

  @Prop({ type: Date, default: () => new Date() })
  takenAt: Date;
}

export const MemorySchema = SchemaFactory.createForClass(Memory);

// Las dos consultas del listado: "mis fotos" y "fotos de mis viajes", ya ordenadas por fecha.
MemorySchema.index({ user: 1, takenAt: -1 });
MemorySchema.index({ trip: 1, takenAt: -1 });
