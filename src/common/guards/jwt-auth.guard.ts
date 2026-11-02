import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  AuthenticatedRequest,
  JwtPayload,
} from '../interfaces/authenticated-request.interface';
/**
 * Protege rutas que requieren sesión.
 *
 * Lee el token de la cabecera "Authorization: Bearer <token>", verifica su firma
 * y su expiración, y deja el payload ({ sub, iat, exp }) en request.user para que
 * el controller sepa qué usuario hizo la petición.
 *
 * Se usa con @UseGuards(JwtAuthGuard) en un controller o en una ruta.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Debes iniciar sesión');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      request.user = payload;
    } catch {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }

    return true;
  }

  /**
   * Lee "Authorization: Bearer <token>" y devuelve solo el token.
   * Devuelve undefined si la cabecera no existe o no es de tipo Bearer.
   */
  private extractToken(request: AuthenticatedRequest): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer') {
      return undefined;
    }

    return token;
  }
}
