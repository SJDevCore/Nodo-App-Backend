import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { LocationsService } from './locations.service';
import { UpdateLocationDto } from './dto/update-location.dto';

/**
 * Rutas de ubicaciones: /api/v1/locations
 * Requieren sesión (JwtAuthGuard); el payload del token trae { sub } (decisión 016).
 * Este canal HTTP se usa sobre todo para enviar la posición en segundo plano,
 * cuando el SO cierra los sockets.
 */
@ApiTags('Locations')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sin token, o token inválido o expirado' })
@UseGuards(JwtAuthGuard)
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post()
  @ApiOperation({
    summary: 'Registra (upsert) la última ubicación del usuario autenticado',
  })
  @ApiOkResponse({ description: 'Ubicación guardada (lista blanca de salida)' })
  upsert(@Req() req: AuthenticatedRequest, @Body() dto: UpdateLocationDto) {
    return this.locationsService.upsert(req.user.sub, dto);
  }
}
