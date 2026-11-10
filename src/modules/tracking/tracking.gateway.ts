import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import type { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { TripsService } from '../trips/trips.service';

/** Posición en vivo de un integrante. */
export interface LivePosition {
  userId: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  at: number; // milisegundos (Date.now)
}

const roomOf = (tripId: string) => `trip:${tripId}`;

/**
 * Ubicación en vivo. Cada viaje es una "room": lo que un integrante envía
 * solo lo reciben los demás integrantes de ese viaje.
 *
 * Mismo puerto que la API, namespace /tracking. El prefijo /api/v1 no aplica a sockets.
 */
@WebSocketGateway({ namespace: '/tracking', cors: { origin: '*' } })
export class TrackingGateway implements OnGatewayInit, OnGatewayDisconnect {
  private readonly logger = new Logger(TrackingGateway.name);

  /**
   * Última posición por viaje y por usuario. En memoria para la primera versión:
   * se pierde al reiniciar el servidor. Sirve para que quien entra vea de inmediato
   * a los demás, sin esperar su siguiente envío.
   */
  private readonly lastPositions = new Map<string, Map<string, LivePosition>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly tripsService: TripsService,
  ) {}

  /**
   * Autenticación ANTES de aceptar la conexión (middleware de Socket.IO).
   * Si el token falla, el cliente recibe "connect_error" con el mensaje y nunca queda conectado.
   */
  afterInit(namespace: Namespace): void {
    namespace.use((socket, next) => {
      const token: unknown = socket.handshake.auth?.token;
      if (typeof token !== 'string') {
        return next(new Error('Debes iniciar sesión'));
      }
      this.jwtService
        .verifyAsync<JwtPayload>(token)
        .then((payload) => {
          socket.data.userId = payload.sub;
          next();
        })
        .catch(() => next(new Error('Sesión inválida o expirada')));
    });
  }

  /** Entrar a la room del viaje. Responde (ack) con las posiciones actuales. */
  @SubscribeMessage('trip:join')
  async joinTrip(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { tripId?: unknown },
  ) {
    const userId = client.data.userId as string;
    const tripId = typeof body?.tripId === 'string' ? body.tripId : '';

    if (!(await this.tripsService.isActiveMember(userId, tripId))) {
      return { ok: false, message: 'No eres integrante de este viaje activo' };
    }

    const previous = client.data.tripId as string | undefined;
    if (previous && previous !== tripId) {
      await client.leave(roomOf(previous));
    }
    await client.join(roomOf(tripId));
    client.data.tripId = tripId;

    const positions = [...(this.lastPositions.get(tripId)?.values() ?? [])];
    return { ok: true, positions };
  }

  /** Recibe la ubicación y la reenvía SOLO a los demás integrantes del viaje. */
  @SubscribeMessage('location:update')
  updateLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ) {
    const userId = client.data.userId as string;
    const tripId = client.data.tripId as string | undefined;
    if (!tripId) {
      return { ok: false, message: 'Primero únete a un viaje' };
    }

    const position = this.parsePosition(userId, body);
    if (!position) {
      return { ok: false, message: 'Ubicación inválida' };
    }

    let tripPositions = this.lastPositions.get(tripId);
    if (!tripPositions) {
      tripPositions = new Map();
      this.lastPositions.set(tripId, tripPositions);
    }
    tripPositions.set(userId, position); // sobrescribe: una sola posición por usuario

    client.to(roomOf(tripId)).emit('location:updated', position);
    return { ok: true };
  }

  /** Avisa a los demás que este integrante se desconectó. */
  handleDisconnect(client: Socket): void {
    const tripId = client.data.tripId as string | undefined;
    if (tripId) {
      client
        .to(roomOf(tripId))
        .emit('member:offline', { userId: client.data.userId });
    }
  }

  /**
   * Validación manual: el ValidationPipe global está pensado para HTTP.
   * Nunca se confía en lo que envía el cliente.
   */
  private parsePosition(userId: string, body: unknown): LivePosition | null {
    if (typeof body !== 'object' || body === null) return null;
    const { lat, lng, heading, speed } = body as Record<string, unknown>;

    const isNum = (v: unknown): v is number =>
      typeof v === 'number' && Number.isFinite(v);
    if (
      !isNum(lat) ||
      !isNum(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return null;
    }

    return {
      userId,
      lat,
      lng,
      heading: isNum(heading) && heading >= 0 ? heading : null,
      speed: isNum(speed) && speed >= 0 ? speed : null,
      at: Date.now(), // la hora la pone el servidor, no el cliente
    };
  }
}
