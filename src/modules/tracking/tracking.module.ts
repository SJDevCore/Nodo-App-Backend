import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TripsModule } from '../trips/trips.module';
import { PositionsService } from './positions.service';
import { Position, PositionSchema } from './schemas/position.schema';
import { TrackingGateway } from './tracking.gateway';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Position.name, schema: PositionSchema },
    ]),
    TripsModule, // para usar TripsService.isActiveMember
  ],
  providers: [TrackingGateway, PositionsService],
})
export class TrackingModule {}
