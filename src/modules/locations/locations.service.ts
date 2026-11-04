import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Location, LocationDocument } from './schemas/location.schema';
import { UpdateLocationDto } from './dto/update-location.dto';

/**
 * Datos de ubicación que pueden provenir del REST o del evento de socket.
 * Se mantiene separado del DTO para no acoplar la capa WS a class-validator.
 */
export interface LocationInput {
  lng: number;
  lat: number;
  accuracy?: number;
  battery?: number;
}

/** Lista blanca de salida para una ubicación (decisión 019). */
export interface LocationView {
  userId: string;
  lng: number;
  lat: number;
  accuracy?: number;
  battery?: number;
  updatedAt: Date;
}

@Injectable()
export class LocationsService {
  constructor(
    @InjectModel(Location.name)
    private readonly locationModel: Model<Location>,
  ) {}

  /**
   * Crea o actualiza (upsert) la ÚNICA ubicación del usuario.
   * Guarda point como GeoJSON con coordinates [lng, lat] (longitud primero).
   * updatedAt se refresca automáticamente por timestamps del esquema.
   */
  async upsert(
    userId: string,
    input: LocationInput | UpdateLocationDto,
  ): Promise<LocationView> {
    const location = await this.locationModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        {
          // CONVENCIÓN GeoJSON: [lng, lat] en ese orden
          point: { type: 'Point', coordinates: [input.lng, input.lat] },
          accuracy: input.accuracy,
          battery: input.battery,
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();

    return this.toLocationView(location);
  }

  /**
   * Obtiene las ubicaciones de un conjunto de usuarios (p. ej. los integrantes
   * de una sala), devueltas como lista blanca de salida.
   */
  async findByUserIds(userIds: string[]): Promise<LocationView[]> {
    if (userIds.length === 0) {
      return [];
    }

    const objectIds = userIds.map((id) => new Types.ObjectId(id));
    const locations = await this.locationModel
      .find({ userId: { $in: objectIds } })
      .exec();

    return locations.map((location) => this.toLocationView(location));
  }

  /** Convierte un documento de ubicación a la vista pública [lng, lat]. */
  private toLocationView(location: LocationDocument): LocationView {
    const [lng, lat] = location.point.coordinates;
    return {
      userId: location.userId.toString(),
      lng,
      lat,
      ...(location.accuracy !== undefined && location.accuracy !== null
        ? { accuracy: location.accuracy }
        : {}),
      ...(location.battery !== undefined && location.battery !== null
        ? { battery: location.battery }
        : {}),
      updatedAt: (location as unknown as { updatedAt: Date }).updatedAt,
    };
  }
}
