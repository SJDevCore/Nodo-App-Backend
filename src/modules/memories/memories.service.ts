import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { TripsService } from '../trips/trips.service';
import { CloudinaryService } from './cloudinary.service';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { Memory } from './schemas/memory.schema';
import 'multer';

const LIST_LIMIT = 200;

/** Recuerdo tal como lo recibe el frontend. */
export interface MemoryView {
  id: string;
  title: string;
  imageUrl: string;
  lat: number | null;
  lng: number | null;
  takenAt: string;
  author: { id: string; name: string };
  trip: { id: string; name: string } | null;
}

/** Recuerdo leído con populate de usuario y viaje. */
type PopulatedMemory = Omit<Memory, 'user' | 'trip'> & {
  _id: Types.ObjectId;
  user: { _id: Types.ObjectId; name: string } | null;
  trip: { _id: Types.ObjectId; name: string } | null;
};

@Injectable()
export class MemoriesService {
  constructor(
    @InjectModel(Memory.name) private readonly memoryModel: Model<Memory>,
    private readonly tripsService: TripsService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  /**
   * Guarda un recuerdo. El viaje no lo manda el cliente: el servidor usa
   * el viaje activo del usuario, así nadie puede colgar fotos en un viaje ajeno.
   */
  async create(
    userId: string,
    dto: CreateMemoryDto,
    photo: Express.Multer.File,
  ): Promise<MemoryView> {
    const activeTrip = await this.tripsService.findActiveByUser(userId);
    const image = await this.cloudinary.upload(photo.buffer);

    // La ubicación solo vale completa: latitud sin longitud no sirve.
    const hasPlace = dto.lat !== undefined && dto.lng !== undefined;

    try {
      const created = await this.memoryModel.create({
        user: new Types.ObjectId(userId),
        trip: activeTrip ? new Types.ObjectId(activeTrip.id) : null,
        title: dto.title?.trim() || 'Sin título',
        imageUrl: image.url,
        publicId: image.publicId,
        lat: hasPlace ? dto.lat : null,
        lng: hasPlace ? dto.lng : null,
      });
      return (await this.findOneView(created._id))!;
    } catch (error) {
      // Si Mongo falla, la imagen quedaría huérfana en Cloudinary: se borra.
      await this.cloudinary.destroy(image.publicId);
      throw error;
    }
  }

  /** Mis recuerdos y los de todos los viajes donde participo, del más reciente al más antiguo. */
  async findAllForUser(userId: string): Promise<MemoryView[]> {
    const tripIds = await this.tripsService.findTripIdsByUser(userId);

    const memories = await this.memoryModel
      .find({
        $or: [{ user: new Types.ObjectId(userId) }, { trip: { $in: tripIds } }],
      })
      .sort({ takenAt: -1 })
      .limit(LIST_LIMIT)
      .populate('user', 'name')
      .populate('trip', 'name')
      .lean<PopulatedMemory[]>()
      .exec();

    return memories.map((memory) => this.toView(memory));
  }

  /**
   * Borra un recuerdo. Solo su autor.
   * Si no es suyo responde 404 (y no 403), para no revelar que existe.
   */
  async remove(userId: string, memoryId: string): Promise<void> {
    const deleted = isValidObjectId(memoryId)
      ? await this.memoryModel
          .findOneAndDelete({ _id: memoryId, user: new Types.ObjectId(userId) })
          .lean()
          .exec()
      : null;

    if (!deleted) {
      throw new NotFoundException('Recuerdo no encontrado');
    }
    await this.cloudinary.destroy(deleted.publicId);
  }

  private async findOneView(id: Types.ObjectId): Promise<MemoryView | null> {
    const memory = await this.memoryModel
      .findById(id)
      .populate('user', 'name')
      .populate('trip', 'name')
      .lean<PopulatedMemory>()
      .exec();
    return memory ? this.toView(memory) : null;
  }

  private toView(memory: PopulatedMemory): MemoryView {
    return {
      id: memory._id.toString(),
      title: memory.title,
      imageUrl: memory.imageUrl,
      lat: memory.lat,
      lng: memory.lng,
      takenAt: new Date(memory.takenAt).toISOString(),
      author: memory.user
        ? { id: memory.user._id.toString(), name: memory.user.name }
        : { id: '', name: 'Usuario eliminado' },
      trip: memory.trip
        ? { id: memory.trip._id.toString(), name: memory.trip.name }
        : null,
    };
  }
}
