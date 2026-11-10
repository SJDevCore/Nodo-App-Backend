import { Module } from '@nestjs/common';
import { TripsModule } from '../trips/trips.module';
import { TrackingGateway } from './tracking.gateway';

@Module({
  imports: [TripsModule], // para usar TripsService.isActiveMember
  providers: [TrackingGateway],
})
export class TrackingModule {}
