import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { envValidationSchema } from './config/env.validation';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { LocationsModule } from './modules/locations/locations.module';
import { RealtimeModule } from './modules/realtime/realtime.module';

@Module({
  imports: [
    /**
     * Carga el archivo .env y valida su contenido con Joi.
     * isGlobal: el ConfigService queda disponible en todos los módulos
     * sin tener que importar ConfigModule en cada uno.
     */
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),

    /**
     * Conexión a MongoDB.
     * Se usa forRootAsync (y no forRoot) para esperar a que ConfigModule
     * cargue y valide las variables antes de leer MONGO_URI.
     */
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGO_URI'),
        onConnectionCreate: (connection) => {
          const logger = new Logger('MongoDB');
          connection.on('connected', () =>
            logger.log(`Conectado a la base "${connection.name}"`),
          );
          connection.on('disconnected', () => logger.warn('Desconectado'));
          return connection;
        },
      }),
    }),

    HealthModule,

    UsersModule,

    AuthModule,

    RoomsModule,

    LocationsModule,

    RealtimeModule,
  ],
})
export class AppModule {}
