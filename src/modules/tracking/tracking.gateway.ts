import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import type { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { TripsService } from '../trips/trips.service';
import type { LivePosition, MemberPosition } from './live-position.interface';
import { PositionsService } from './positions.service';

/** Cada cuánto, como mínimo, se guarda en Mongo la posición de un mismo integrante. */
const SAVE_EVERY_MS = 30_000;

/** Posición en memoria y cuándo se guardó por última vez en Mongo. */
interface Tracked {
  position: LivePosition;
  savedAt: number;
}

const roomOf = (tripId: string) => `trip:${tripId}`;

/**
 * Ubicación en vivo. Cada viaje es una "room": lo que un integrante envía
 * solo lo reciben los demás integrantes de ese viaje.
 *
 * Mismo puerto que la API, namespace /tracking. El prefijo /api/v1 no aplica a sockets.
 *
 * Dos niveles de almacenamiento:
 * - Memoria: cada posición que llega (cada pocos segundos). De aquí sale el tiempo real.
 * - Mongo: la última posición de cada integrante, como mucho cada 30 s y al desconectarse.
 *   Es el respaldo: sobrevive a reinicios y permite mostrar "última vez visto".
 */
@WebSocketGateway({ namespace: '/tracking', cors: { origin: '*' } })
export class TrackingGateway implements OnGatewayInit, OnGatewayDisconnect {
  private readonly logger = new Logger(TrackingGateway.name);

  @WebSocketServer()
  private readonly server!: Namespace;

  /** Última posición por viaje y por usuario. */
  private readonly trips = new Map<string, Map<string, Tracked>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly tripsService: TripsService,
    private readonly positionsService: PositionsService,
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

  /**
   * Entrar a la room del viaje. Responde (ack) con la última posición conocida
   * de cada integrante y si está conectado en este momento.
   */
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

    const tracked = await this.loadTrip(tripId);
    const online = await this.onlineUserIds(tripId);

    const positions: MemberPosition[] = [...tracked.values()].map(
      ({ position }) => ({ ...position, online: online.has(position.userId) }),
    );
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

    let tracked = this.trips.get(tripId);
    if (!tracked) {
      tracked = new Map();
      this.trips.set(tripId, tracked);
    }

    // A memoria va siempre; a Mongo solo si pasaron 30 s desde el último guardado.
    const last = tracked.get(userId);
    const mustSave = !last || position.at - last.savedAt >= SAVE_EVERY_MS;
    tracked.set(userId, {
      position, // sobrescribe: una sola posición por usuario
      savedAt: mustSave ? position.at : last.savedAt,
    });
    if (mustSave) {
      this.persist(tripId, position);
    }

    const payload: MemberPosition = { ...position, online: true };
    client.to(roomOf(tripId)).emit('location:updated', payload);
    return { ok: true };
  }

  /**
   * Al desconectarse: guarda su última posición y avisa a los demás.
   * Los demás lo siguen viendo en el mapa, marcado como desconectado.
   */
  async handleDisconnect(client: Socket): Promise<void> {
    const tripId = client.data.tripId as string | undefined;
    const userId = client.data.userId as string | undefined;
    if (!tripId || !userId) return;

    // Si sigue conectado desde otro dispositivo o pestaña, no está "offline".
    const online = await this.onlineUserIds(tripId);
    if (online.has(userId)) return;

    const last = this.trips.get(tripId)?.get(userId);
    if (last) {
      this.persist(tripId, last.position);
    }

    this.server.to(roomOf(tripId)).emit('member:offline', { userId });

    // Nadie conectado: se libera la memoria del viaje. Lo guardado en Mongo queda.
    if (online.size === 0) {
      this.trips.delete(tripId);
    }
  }

  // ─── Internos ───────────────────────────────────────────────

  /**
   * Posiciones del viaje en memoria. Si no hay nada (el servidor se reinició
   * o nadie estaba conectado), las recupera de Mongo.
   */
  private async loadTrip(tripId: string): Promise<Map<string, Tracked>> {
    const inMemory = this.trips.get(tripId);
    if (inMemory) return inMemory;

    const tracked = new Map<string, Tracked>();
    try {
      for (const position of await this.positionsService.findByTrip(tripId)) {
        tracked.set(position.userId, { position, savedAt: position.at });
      }
    } catch {
      this.logger.warn(
        `No se pudieron leer las posiciones del viaje ${tripId}`,
      );
    }

    // Mientras se consultaba Mongo, otra conexión pudo haber creado el mapa: gana ese.
    const created = this.trips.get(tripId);
    if (created) return created;

    this.trips.set(tripId, tracked);
    return tracked;
  }

  /** Ids de los usuarios con un socket abierto en la room del viaje. */
  private async onlineUserIds(tripId: string): Promise<Set<string>> {
    const sockets = await this.server.in(roomOf(tripId)).fetchSockets();
    return new Set(sockets.map((socket) => socket.data.userId as string));
  }

  /**
   * Guarda en Mongo sin esperar el resultado: el tiempo real no debe
   * frenarse ni fallar porque la base tarde o esté caída.
   */
  private persist(tripId: string, position: LivePosition): void {
    void this.positionsService.save(tripId, position).catch(() => {
      this.logger.warn(`No se pudo guardar la posición de ${position.userId}`);
    });
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
