import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';

/**
 * Socket.IO con el userId resuelto del JWT del handshake.
 * El gateway guarda el sub en socket.data.userId tras el handshake.
 */
export interface AuthenticatedSocket extends Socket {
  data: { userId?: string };
}

/**
 * Valida el JWT que el cliente envía en el handshake del socket.
 *
 * El token puede venir en handshake.auth.token o en la cabecera
 * Authorization: Bearer <token>. Reutiliza el JwtService global (decisión 021),
 * el mismo que valida las rutas HTTP. Si el token es válido deja el sub en
 * socket.data.userId; si no, devuelve false y el gateway rechaza/desconecta.
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<AuthenticatedSocket>();
    const userId = await WsJwtGuard.resolveUserId(client, this.jwtService);
    if (!userId) {
      this.logger.warn('Conexión WS rechazada: token inválido o ausente');
      return false;
    }
    client.data.userId = userId;
    return true;
  }

  /**
   * Extrae y verifica el token del handshake, devolviendo el sub del usuario
   * o undefined si no es válido. Se expone como estático para que el gateway
   * lo reutilice al autenticar la conexión inicial (handleConnection).
   */
  static async resolveUserId(
    client: AuthenticatedSocket,
    jwtService: JwtService,
  ): Promise<string | undefined> {
    const token = WsJwtGuard.extractToken(client);
    if (!token) {
      return undefined;
    }
    try {
      const payload = await jwtService.verifyAsync<JwtPayload>(token);
      return payload.sub;
    } catch {
      return undefined;
    }
  }

  /** Lee el token de handshake.auth.token o de la cabecera Authorization: Bearer. */
  private static extractToken(client: AuthenticatedSocket): string | undefined {
    const auth = client.handshake.auth as { token?: unknown } | undefined;
    if (auth && typeof auth.token === 'string' && auth.token.length > 0) {
      return auth.token;
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string') {
      const [type, token] = header.split(' ');
      if (type === 'Bearer' && token) {
        return token;
      }
    }

    return undefined;
  }
}
