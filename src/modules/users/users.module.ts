import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './users.controller';

@Module({
  // Registra el modelo User solo para este módulo (la conexión ya existe en AppModule)
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [UsersService],
  // exports: permite que otros módulos (Auth) inyecten UsersService
  exports: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
