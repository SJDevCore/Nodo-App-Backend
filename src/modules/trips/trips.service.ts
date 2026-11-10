import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomInt } from 'crypto';
import { isValidObjectId, Model, Types } from 'mongoose';
import { CreateTripDto } from './dto/create-trip.dto';
import { JoinTripDto } from './dto/join-trip.dto';
import {
  Member,
  Trip,
  TRIP_CODE_ALPHABET,
  TripStatus,
  Vehicle,
} from './schemas/trip.schema';

const CODE_LENGTH = 6;
// Con ~887 millones de códigos posibles, una colisión es rarísima; 5 intentos sobran
const MAX_CODE_ATTEMPTS = 5;

/** Integrante tal como lo recibe el frontend (contrato acordado). */
export interface TripMemberView {
  userId: string;
  name: string;
  vehicle: Vehicle;
  joinedAt: string;
}

/** Viaje tal como lo recibe el frontend (contrato acordado). */
export interface TripView {
  id: string;
  name: string;
  destination?: string;
  code: string;
  ownerId: string;
  status: TripStatus;
  members: TripMemberView[];
  createdAt: string;
  endedAt?: string;
}

/** Viaje leído con populate: cada member.user trae el _id y el nombre del usuario. */
type PopulatedTrip = Omit<Trip, 'members'> & {
  _id: Types.ObjectId;
  createdAt: Date;
  members: Array<
    Omit<Member, 'user'> & {
      user: { _id: Types.ObjectId; name: string } | null;
    }
  >;
};

/**
 * Reglas de los viajes: crear, unirse con código, salir y terminar.
 * Un usuario solo puede estar en UN viaje activo a la vez.
 */
@Injectable()
export class TripsService {
  constructor(
    @InjectModel(Trip.name) private readonly tripModel: Model<Trip>,
  ) {}

  // ─── Consultas ──────────────────────────────────────────────

  /** Viaje activo donde participa el usuario, o null. Usa el índice members.user + status. */
  async findActiveByUser(userId: string): Promise<TripView | null> {
    return this.findOneView({
      'members.user': new Types.ObjectId(userId),
      status: 'active',
    });
  }

  /** GET /trips/active → 404 si no tiene viaje activo. */
  async getActive(userId: string): Promise<TripView> {
    const trip = await this.findActiveByUser(userId);
    if (!trip) {
      throw new NotFoundException('No tienes un viaje activo');
    }
    return trip;
  }

  /**
   * GET /trips/:id → solo para integrantes.
   * Responde 404 (y no 403) si no es integrante, para no revelar que el viaje existe.
   */
  async getById(userId: string, tripId: string): Promise<TripView> {
    const trip = isValidObjectId(tripId)
      ? await this.findOneView({ _id: tripId })
      : null;
    if (!trip || !trip.members.some((m) => m.userId === userId)) {
      throw new NotFoundException('Viaje no encontrado');
    }
    return trip;
  }

  /** Para el gateway de sockets: ¿el usuario es integrante de este viaje activo? */
  async isActiveMember(userId: string, tripId: string): Promise<boolean> {
    if (!isValidObjectId(tripId)) return false;
    const exists = await this.tripModel.exists({
      _id: tripId,
      status: 'active',
      'members.user': new Types.ObjectId(userId),
    });
    return exists !== null;
  }

  // ─── Acciones ───────────────────────────────────────────────

  /** Crea el viaje; el creador queda como dueño y como primer integrante. */
  async create(userId: string, dto: CreateTripDto): Promise<TripView> {
    await this.ensureNoActiveTrip(userId);

    const userObjectId = new Types.ObjectId(userId);
    const created = await this.tripModel.create({
      name: dto.name.trim(),
      destination: dto.destination?.trim(),
      code: await this.generateUniqueCode(),
      owner: userObjectId,
      members: [{ user: userObjectId, vehicle: dto.vehicle }],
    });

    return (await this.findOneView({ _id: created._id }))!;
  }

  /** Une al usuario al viaje que tiene ese código. */
  async join(userId: string, dto: JoinTripDto): Promise<TripView> {
    await this.ensureNoActiveTrip(userId);

    const trip = await this.tripModel
      .findOne({ code: dto.code })
      .select('status')
      .exec();
    if (!trip) {
      throw new NotFoundException('No existe un viaje con ese código');
    }
    if (trip.status !== 'active') {
      throw new ConflictException('Ese viaje ya terminó');
    }

    // Operación atómica: solo agrega si el viaje sigue activo y el usuario no está ya adentro
    const userObjectId = new Types.ObjectId(userId);
    const result = await this.tripModel.updateOne(
      {
        _id: trip._id,
        status: 'active',
        'members.user': { $ne: userObjectId },
      },
      {
        $push: {
          members: {
            user: userObjectId,
            vehicle: dto.vehicle,
            joinedAt: new Date(),
          },
        },
      },
    );
    if (result.modifiedCount === 0) {
      throw new ConflictException(
        'No fue posible unirse: el viaje terminó o ya eres integrante',
      );
    }

    return (await this.findOneView({ _id: trip._id }))!;
  }

  /** Sale del viaje. El creador no puede salir: debe terminarlo. */
  async leave(userId: string, tripId: string): Promise<void> {
    const trip = await this.getById(userId, tripId);
    if (trip.status !== 'active') {
      throw new ConflictException('Ese viaje ya terminó');
    }
    if (trip.ownerId === userId) {
      throw new ConflictException(
        'El creador no puede salir del viaje; debe terminarlo',
      );
    }

    await this.tripModel.updateOne(
      { _id: tripId },
      { $pull: { members: { user: new Types.ObjectId(userId) } } },
    );
  }

  /** Termina el viaje. Solo el creador. */
  async end(userId: string, tripId: string): Promise<TripView> {
    const trip = await this.getById(userId, tripId);
    if (trip.ownerId !== userId) {
      throw new ForbiddenException('Solo el creador puede terminar el viaje');
    }
    if (trip.status === 'ended') {
      return trip;
    }

    await this.tripModel.updateOne(
      { _id: tripId },
      { status: 'ended', endedAt: new Date() },
    );
    return (await this.findOneView({ _id: tripId }))!;
  }

  // ─── Internos ───────────────────────────────────────────────

  private async ensureNoActiveTrip(userId: string): Promise<void> {
    const active = await this.tripModel.exists({
      'members.user': new Types.ObjectId(userId),
      status: 'active',
    });
    if (active) {
      throw new ConflictException(
        'Ya tienes un viaje activo. Sal de él o termínalo primero',
      );
    }
  }

  /**
   * Genera un código de 6 caracteres que no esté en uso.
   * crypto.randomInt y no Math.random(): Math.random es predecible.
   * El índice unique del esquema es la última barrera si dos viajes se crean a la vez.
   */
  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      let code = '';
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += TRIP_CODE_ALPHABET[randomInt(TRIP_CODE_ALPHABET.length)];
      }
      if (!(await this.tripModel.exists({ code }))) {
        return code;
      }
    }
    throw new ConflictException(
      'No se pudo generar un código. Intenta de nuevo',
    );
  }

  /** Busca un viaje, trae el nombre de cada integrante y lo convierte al contrato. */
  private async findOneView(
    filter: Record<string, unknown>,
  ): Promise<TripView | null> {
    const trip = await this.tripModel
      .findOne(filter)
      .populate('members.user', 'name')
      .lean<PopulatedTrip>()
      .exec();
    return trip ? this.toView(trip) : null;
  }

  /** Convierte el documento de Mongo a la forma que espera el frontend. */
  private toView(trip: PopulatedTrip): TripView {
    return {
      id: trip._id.toString(),
      name: trip.name,
      destination: trip.destination,
      code: trip.code,
      ownerId: trip.owner.toString(),
      status: trip.status,
      members: trip.members
        .filter((m) => m.user !== null) // un usuario borrado deja de aparecer
        .map((m) => ({
          userId: m.user!._id.toString(),
          name: m.user!.name,
          vehicle: m.vehicle,
          joinedAt: new Date(m.joinedAt).toISOString(),
        })),
      createdAt: new Date(trip.createdAt).toISOString(),
      endedAt: trip.endedAt ? new Date(trip.endedAt).toISOString() : undefined,
    };
  }
}
