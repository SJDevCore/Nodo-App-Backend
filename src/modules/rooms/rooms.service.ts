import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { customAlphabet } from 'nanoid';
import { Room, RoomDocument } from './schemas/room.schema';
import { RoomMember } from './schemas/room-member.schema';
import {
  LocationsService,
  LocationView,
} from '../locations/locations.service';

// Alfabeto sin caracteres ambiguos (sin 0/O, 1/I/L) y código de 6 caracteres
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
// Número de intentos para evitar colisiones de código antes de rendirse
const MAX_CODE_ATTEMPTS = 5;
// Código de error de MongoDB para violación de índice único
const DUPLICATE_KEY_ERROR = 11000;

@Injectable()
export class RoomsService {
  private readonly generateCode = customAlphabet(CODE_ALPHABET, CODE_LENGTH);

  constructor(
    @InjectModel(Room.name) private readonly roomModel: Model<Room>,
    @InjectModel(RoomMember.name)
    private readonly roomMemberModel: Model<RoomMember>,
    private readonly locationsService: LocationsService,
  ) {}

  /**
   * Crea una sala con un código único, y da de alta al creador como admin.
   * El índice único de code protege contra colisiones aunque dos códigos
   * iguales lleguen a la vez (se reintenta).
   */
  async create(userId: string, name: string) {
    const adminId = new Types.ObjectId(userId);
    const room = await this.createRoomWithUniqueCode(name, adminId);

    await this.roomMemberModel.create({
      roomId: room._id,
      userId: adminId,
      role: 'admin',
      sharing: true,
    });

    return this.toRoomView(room);
  }

  /** Lista las salas a las que pertenece el usuario autenticado. */
  async listForUser(userId: string) {
    const memberships = await this.roomMemberModel
      .find({ userId: new Types.ObjectId(userId) })
      .select('roomId')
      .exec();

    const roomIds = memberships.map((m) => m.roomId);
    const rooms = await this.roomModel.find({ _id: { $in: roomIds } }).exec();

    return rooms.map((room) => this.toRoomView(room));
  }

  /**
   * Detalle de la sala + lista de integrantes (nombre, foto si existe, role, sharing).
   * El controller ya validó la pertenencia con RoomMembershipGuard.
   */
  async getDetail(roomId: string) {
    const room = await this.roomModel.findById(roomId).exec();
    if (!room) {
      throw new NotFoundException('Sala no encontrada');
    }

    const members = await this.roomMemberModel
      .find({ roomId: room._id })
      // Trae los datos públicos del usuario junto a la membresía
      .populate('userId', 'name photo')
      .exec();

    // Solo se expone la ubicación de los integrantes con sharing === true.
    const sharingUserIds = members
      .filter((member) => member.sharing)
      .map((member) => this.extractUserId(member.userId))
      .filter((id): id is string => id !== undefined);

    const locations = await this.locationsService.findByUserIds(sharingUserIds);
    const locationsByUser = new Map<string, LocationView>(
      locations.map((location) => [location.userId, location]),
    );

    return {
      ...this.toRoomView(room),
      members: members.map((member) => {
        const view = this.toMemberView(member);
        // Miembros con sharing=false aparecen en la lista pero con location: null.
        const location =
          member.sharing && view.userId
            ? locationsByUser.get(view.userId) ?? null
            : null;
        return { ...view, location };
      }),
    };
  }

  /**
   * Verifica que el usuario sea miembro de la sala. Devuelve la membresía (con su
   * flag sharing) o null si no pertenece. Lo reutiliza el gateway de tiempo real
   * para autorizar join-room y location-update sin duplicar la consulta.
   */
  async getMembership(
    roomId: string,
    userId: string,
  ): Promise<{ sharing: boolean } | null> {
    if (!Types.ObjectId.isValid(roomId)) {
      return null;
    }
    const membership = await this.roomMemberModel
      .findOne({
        roomId: new Types.ObjectId(roomId),
        userId: new Types.ObjectId(userId),
      })
      .select('sharing')
      .exec();

    return membership ? { sharing: membership.sharing } : null;
  }

  /** Extrae el id del usuario de una membresía (populada o no). */
  private extractUserId(userId: unknown): string | undefined {
    if (userId instanceof Types.ObjectId) {
      return userId.toString();
    }
    const populated = userId as { _id?: Types.ObjectId } | null;
    return populated?._id?.toString();
  }

  /**
   * Une al usuario a la sala identificada por su código, con role 'member'.
   * El índice único { roomId, userId } garantiza idempotencia frente a carreras:
   * si ya es miembro, se responde 409 limpio.
   */
  async join(userId: string, code: string) {
    const room = await this.roomModel.findOne({ code: code.trim() }).exec();
    if (!room) {
      throw new NotFoundException('No existe una sala con ese código');
    }

    try {
      await this.roomMemberModel.create({
        roomId: room._id,
        userId: new Types.ObjectId(userId),
        role: 'member',
        sharing: true,
      });
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('Ya eres miembro de esta sala');
      }
      throw error;
    }

    return this.toRoomView(room);
  }

  /**
   * Expulsa a un integrante. Solo el admin de la sala puede hacerlo y no puede
   * expulsarse a sí mismo (dejaría la sala sin admin).
   */
  async removeMember(roomId: string, requesterId: string, targetUserId: string) {
    const room = await this.roomModel.findById(roomId).exec();
    if (!room) {
      throw new NotFoundException('Sala no encontrada');
    }

    if (room.adminId.toString() !== requesterId) {
      throw new ForbiddenException(
        'Solo el administrador de la sala puede expulsar integrantes',
      );
    }

    if (targetUserId === requesterId) {
      throw new ForbiddenException(
        'El administrador no puede expulsarse a sí mismo de la sala',
      );
    }

    const deleted = await this.roomMemberModel
      .findOneAndDelete({
        roomId: room._id,
        userId: new Types.ObjectId(targetUserId),
      })
      .exec();

    if (!deleted) {
      throw new NotFoundException('El usuario no pertenece a esta sala');
    }

    return { removed: true };
  }

  /**
   * Pausa o reanuda el compartir del usuario autenticado EN esa sala.
   * El controller ya validó la pertenencia con RoomMembershipGuard.
   */
  async updateSharing(roomId: string, userId: string, sharing: boolean) {
    const membership = await this.roomMemberModel
      .findOneAndUpdate(
        {
          roomId: new Types.ObjectId(roomId),
          userId: new Types.ObjectId(userId),
        },
        { sharing },
        { new: true },
      )
      .exec();

    if (!membership) {
      throw new NotFoundException('No perteneces a esta sala');
    }

    return { roomId, sharing: membership.sharing };
  }

  /** Genera un código único reintentando ante colisiones del índice único. */
  private async createRoomWithUniqueCode(
    name: string,
    adminId: Types.ObjectId,
  ): Promise<RoomDocument> {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      try {
        return await this.roomModel.create({
          name: name.trim(),
          code: this.generateCode(),
          adminId,
        });
      } catch (error) {
        if (this.isDuplicateKeyError(error)) {
          continue;
        }
        throw error;
      }
    }
    throw new ConflictException(
      'No se pudo generar un código de sala único, intenta de nuevo',
    );
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: number }).code === DUPLICATE_KEY_ERROR
    );
  }

  /** Lista blanca de salida para una sala (decisión 019). */
  private toRoomView(room: RoomDocument) {
    return {
      id: room.id as string,
      name: room.name,
      code: room.code,
      adminId: room.adminId.toString(),
      createdAt: (room as unknown as { createdAt: Date }).createdAt,
    };
  }

  /** Lista blanca de salida para un integrante: nunca expone datos sensibles. */
  private toMemberView(member: {
    userId: unknown;
    role: string;
    sharing: boolean;
  }) {
    const user = member.userId as {
      _id: Types.ObjectId;
      name?: string;
      photo?: string;
    } | null;

    return {
      userId: user?._id?.toString(),
      name: user?.name,
      // photo solo se incluye si el usuario tiene el campo (opcional en esta fase)
      ...(user?.photo ? { photo: user.photo } : {}),
      role: member.role,
      sharing: member.sharing,
    };
  }
}
