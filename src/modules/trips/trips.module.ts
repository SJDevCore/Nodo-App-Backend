import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Trip, TripSchema } from './schemas/trip.schema';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Trip.name, schema: TripSchema }]),
  ],
  controllers: [TripsController],
  providers: [TripsService],
  // El gateway de sockets usará TripsService para verificar que el usuario es integrante
  exports: [TripsService],
})
export class TripsModule {}
