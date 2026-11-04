import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RoomMemberDocument = HydratedDocument<RoomMember>;

export const ROOM_ROLES = ['admin', 'member'] as const;
export type RoomRole = (typeof ROOM_ROLES)[number];

/**
 * Membresía: vincula un usuario con una sala y su rol dentro de ella.
 * timestamps: joinedAt se modela como createdAt (fecha de alta en la sala).
 * versionKey: false → elimina el campo interno __v.
 */
@Schema({
  timestamps: { createdAt: 'joinedAt', updatedAt: false },
  versionKey: false,
})
export class RoomMember {
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  roomId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: ROOM_ROLES, default: 'member' })
  role: RoomRole;

  // Si está en pausa (false) el usuario deja de compartir su ubicación en esa sala
  @Prop({ required: true, default: true })
  sharing: boolean;
}

export const RoomMemberSchema = SchemaFactory.createForClass(RoomMember);

/**
 * Índice compuesto ÚNICO: un usuario solo puede tener una membresía por sala.
 * Igual que el email único de users (decisión 014), la base es la última barrera
 * contra duplicados y condiciones de carrera al unirse a la vez.
 */
RoomMemberSchema.index({ roomId: 1, userId: 1 }, { unique: true });
