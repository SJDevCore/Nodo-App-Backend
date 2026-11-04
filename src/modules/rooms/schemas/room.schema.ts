import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RoomDocument = HydratedDocument<Room>;

/**
 * Sala: grupo al que se unen varios integrantes para compartir ubicación.
 * timestamps: agrega createdAt y updatedAt automáticamente.
 * versionKey: false → elimina el campo interno __v.
 */
@Schema({ timestamps: true, versionKey: false })
export class Room {
  @Prop({ required: true, trim: true, maxlength: 60 })
  name: string;

  // unique crea un índice en Mongo: la base misma impide códigos repetidos
  @Prop({ required: true, unique: true, trim: true })
  code: string;

  // Referencia al usuario que creó la sala (es su admin)
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  adminId: Types.ObjectId;
}

export const RoomSchema = SchemaFactory.createForClass(Room);
