import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RoomMembershipGuard } from '../../common/guards/room-membership.guard';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { UpdateSharingDto } from './dto/update-sharing.dto';

/**
 * Rutas de salas: /api/v1/rooms/...
 * Todas requieren sesión (JwtAuthGuard); el payload del token trae { sub } (decisión 016).
 */
@ApiTags('Rooms')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sin token, o token inválido o expirado' })
@UseGuards(JwtAuthGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @ApiOperation({
    summary: 'Crea una sala y agrega al creador como administrador',
  })
  @ApiCreatedResponse({ description: 'Sala creada con su código de invitación' })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateRoomDto) {
    return this.roomsService.create(req.user.sub, dto.name);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista las salas a las que pertenece el usuario autenticado',
  })
  @ApiOkResponse({ description: 'Salas del usuario' })
  list(@Req() req: AuthenticatedRequest) {
    return this.roomsService.listForUser(req.user.sub);
  }

  @Post('join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Une al usuario a una sala con su código' })
  @ApiOkResponse({ description: 'Unido a la sala' })
  @ApiNotFoundResponse({ description: 'No existe una sala con ese código' })
  @ApiConflictResponse({ description: 'El usuario ya es miembro de la sala' })
  join(@Req() req: AuthenticatedRequest, @Body() dto: JoinRoomDto) {
    return this.roomsService.join(req.user.sub, dto.code);
  }

  @Get(':id')
  @UseGuards(RoomMembershipGuard)
  @ApiOperation({
    summary: 'Detalle de la sala y lista de integrantes (requiere ser miembro)',
  })
  @ApiOkResponse({ description: 'Detalle de la sala con sus integrantes' })
  @ApiForbiddenResponse({ description: 'No perteneces a esta sala' })
  @ApiNotFoundResponse({ description: 'Sala no encontrada' })
  getDetail(@Param('id') id: string) {
    return this.roomsService.getDetail(id);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({
    summary: 'Expulsa a un integrante (solo el administrador de la sala)',
  })
  @ApiOkResponse({ description: 'Integrante expulsado' })
  @ApiForbiddenResponse({
    description: 'Solo el administrador puede expulsar y no a sí mismo',
  })
  @ApiNotFoundResponse({ description: 'Sala o integrante no encontrado' })
  removeMember(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.roomsService.removeMember(id, req.user.sub, userId);
  }

  @Patch(':id/sharing')
  @UseGuards(RoomMembershipGuard)
  @ApiOperation({
    summary: 'Pausa o reanuda el compartir del usuario en esa sala',
  })
  @ApiOkResponse({ description: 'Estado de compartir actualizado' })
  @ApiForbiddenResponse({ description: 'No perteneces a esta sala' })
  updateSharing(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateSharingDto,
  ) {
    return this.roomsService.updateSharing(id, req.user.sub, dto.sharing);
  }
}
