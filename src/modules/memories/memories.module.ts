import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TripsModule } from '../trips/trips.module';
import { CloudinaryService } from './cloudinary.service';
import { MemoriesController } from './memories.controller';
import { MemoriesService } from './memories.service';
import { Memory, MemorySchema } from './schemas/memory.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Memory.name, schema: MemorySchema }]),
    TripsModule, // exporta TripsService
  ],
  controllers: [MemoriesController],
  providers: [MemoriesService, CloudinaryService],
})
export class MemoriesModule {}
