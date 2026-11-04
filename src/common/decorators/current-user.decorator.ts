import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type {
  AuthenticatedRequest,
  JwtPayload,
} from '../interfaces/authenticated-request.interface';

/**
 * Entrega el payload del token (lo que JwtAuthGuard dejó en request.user).
 * Así los controllers no dependen del objeto Request ni de Express.
 * Uso: me(@CurrentUser() user: JwtPayload)
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
