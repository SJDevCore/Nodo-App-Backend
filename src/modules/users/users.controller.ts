import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { UsersService } from './users.service';

/**
 * Rutas de usuarios: /api/v1/users/...
 * Todas las rutas que dependen del usuario autenticado usan JwtAuthGuard.
 */
@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /api/v1/users/me
   * Devuelve el perfil del usuario dueño del token.
   *
   * Se consulta la base en vez de responder solo con el token porque un JWT
   * sigue siendo válido aunque el usuario se haya borrado: el guard solo verifica
   * la firma y la expiración, no que el usuario exista.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({
    description: 'Perfil del usuario autenticado (sin contraseña)',
  })
  @ApiUnauthorizedResponse({
    description: 'Sin token, o token inválido o expirado',
  })
  @ApiNotFoundResponse({ description: 'El usuario del token ya no existe' })
  async me(@CurrentUser() user: JwtPayload) {
    // El guard ya verificó el token: aquí user.sub siempre existe
    const found = await this.usersService.findById(user.sub);

    if (!found) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return found;
  }
}
