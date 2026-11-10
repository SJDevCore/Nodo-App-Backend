import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { CreateTripDto } from './dto/create-trip.dto';
import { JoinTripDto } from './dto/join-trip.dto';
import { TripsService } from './trips.service';

/**
 * Rutas de viajes: /api/v1/trips/...
 * Todas requieren sesión: el guard va a nivel de clase.
 */
@ApiTags('Trips')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  /** POST /trips → 201. 409 si ya tiene un viaje activo. */
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTripDto) {
    return this.tripsService.create(user.sub, dto);
  }

  /** POST /trips/join → 200 (no crea un viaje, agrega un integrante). 404 código inexistente · 409 terminado o ya tiene viaje. */
  @Post('join')
  @HttpCode(HttpStatus.OK)
  join(@CurrentUser() user: JwtPayload, @Body() dto: JoinTripDto) {
    return this.tripsService.join(user.sub, dto);
  }

  /** GET /trips/active. Va ANTES de ':id' para que "active" no se lea como un id. */
  @Get('active')
  getActive(@CurrentUser() user: JwtPayload) {
    return this.tripsService.getActive(user.sub);
  }

  /** GET /trips/:id → solo integrantes. */
  @Get(':id')
  getById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.tripsService.getById(user.sub, id);
  }

  /** POST /trips/:id/leave → 204 sin contenido. */
  @Post(':id/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  leave(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.tripsService.leave(user.sub, id);
  }

  /** POST /trips/:id/end → solo el creador. */
  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  end(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.tripsService.end(user.sub, id);
  }
}
