import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { Room, RoomSchema } from './schemas/room.schema';
import {
  RoomMember,
  RoomMemberSchema,
} from './schemas/room-member.schema';
import { RoomMembershipGuard } from '../../common/guards/room-membership.guard';
import { UsersModule } from '../users/users.module';
import { LocationsModule } from '../locations/locations.module';

@Module({
  imports: [
    // Registra los modelos Room y RoomMember solo para este módulo
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: RoomMember.name, schema: RoomMemberSchema },
    ]),
    // UsersModule exporta UsersService (datos públicos de los integrantes)
    UsersModule,
    // LocationsModule exporta LocationsService (última ubicación de cada integrante)
    LocationsModule,
  ],
  controllers: [RoomsController],
  providers: [RoomsService, RoomMembershipGuard],
  // exports: el gateway de tiempo real reutiliza RoomsService
  exports: [RoomsService],
})
export class RoomsModule {}
