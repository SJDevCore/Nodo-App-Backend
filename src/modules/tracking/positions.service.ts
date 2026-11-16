import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { LivePosition } from './live-position.interface';
import { Position } from './schemas/position.schema';

/** Lee y escribe la última posición conocida de cada integrante. */
@Injectable()
export class PositionsService {
  constructor(
    @InjectModel(Position.name) private readonly positionModel: Model<Position>,
  ) {}

  /** Guarda la posición sobrescribiendo la anterior (upsert: la crea si no existe). */
  async save(tripId: string, position: LivePosition): Promise<void> {
    await this.positionModel.updateOne(
      {
        trip: new Types.ObjectId(tripId),
        user: new Types.ObjectId(position.userId),
      },
      {
        $set: {
          lat: position.lat,
          lng: position.lng,
          heading: position.heading,
          speed: position.speed,
          at: new Date(position.at),
        },
      },
      { upsert: true },
    );
  }

  /** Últimas posiciones guardadas de un viaje. */
  async findByTrip(tripId: string): Promise<LivePosition[]> {
    const positions = await this.positionModel
      .find({ trip: new Types.ObjectId(tripId) })
      .lean()
      .exec();

    return positions.map((position) => ({
      userId: position.user.toString(),
      lat: position.lat,
      lng: position.lng,
      heading: position.heading,
      speed: position.speed,
      at: new Date(position.at).getTime(),
    }));
  }
}
