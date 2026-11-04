import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { WsJwtGuard } from './ws-jwt.guard';
import { RoomsModule } from '../rooms/rooms.module';
import { LocationsModule } from '../locations/locations.module';

@Module({
  imports: [
    // RoomsModule exporta RoomsService (verificación de pertenencia y sharing)
    RoomsModule,
    // LocationsModule exporta LocationsService (persistencia de la ubicación)
    LocationsModule,
  ],
  // JwtModule es global (decisión 021), así que JwtService ya está disponible.
  providers: [RealtimeGateway, WsJwtGuard],
})
export class RealtimeModule {}
