import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { RoomMember } from '../../modules/rooms/schemas/room-member.schema';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

/**
 * Verifica que el usuario autenticado sea miembro de la sala de la ruta.
 *
 * Se usa DESPUÉS de JwtAuthGuard (que ya dejó el payload en request.user) en rutas
 * con el parámetro :id de la sala. Consulta room_members por { roomId, userId: sub }
 * y responde 403 si no hay membresía.
 */
@Injectable()
export class RoomMembershipGuard implements CanActivate {
  constructor(
    @InjectModel(RoomMember.name)
    private readonly roomMemberModel: Model<RoomMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const roomId = request.params.id;

    if (typeof roomId !== 'string' || !isValidObjectId(roomId)) {
      throw new BadRequestException('Identificador de sala inválido');
    }

    const membership = await this.roomMemberModel.exists({
      roomId: new Types.ObjectId(roomId),
      userId: new Types.ObjectId(request.user.sub),
    });

    if (!membership) {
      throw new ForbiddenException('No perteneces a esta sala');
    }

    return true;
  }
}
