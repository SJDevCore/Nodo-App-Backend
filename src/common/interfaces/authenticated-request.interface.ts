import { Request } from 'express';

/**
 * Contenido del JWT emitido en el login.
 * sub: id del usuario. iat/exp: fechas de emisión y expiración (en segundos).
 */
export interface JwtPayload {
  sub: string;
  iat: number;
  exp: number;
}

/**
 * Petición HTTP que ya pasó por JwtAuthGuard: tiene el payload del token en "user".
 * Se usa en los controllers protegidos para leer quién hizo la petición.
 */
export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
