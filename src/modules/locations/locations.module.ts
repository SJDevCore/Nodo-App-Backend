import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { Location, LocationSchema } from './schemas/location.schema';

@Module({
  imports: [
    // Registra el modelo Location solo para este módulo (la conexión ya existe en AppModule)
    MongooseModule.forFeature([
      { name: Location.name, schema: LocationSchema },
    ]),
  ],
  controllers: [LocationsController],
  providers: [LocationsService],
  // exports: RoomsModule y el gateway de tiempo real reutilizan LocationsService
  exports: [LocationsService],
})
export class LocationsModule {}
