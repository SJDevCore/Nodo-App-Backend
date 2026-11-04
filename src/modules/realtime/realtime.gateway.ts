import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { RoomsService } from '../rooms/rooms.service';
import { LocationsService } from '../locations/locations.service';
import { WsJwtGuard } from './ws-jwt.guard';
import type { AuthenticatedSocket } from './ws-jwt.guard';

/** Payload de los eventos cliente→servidor que operan sobre una sala. */
interface RoomPayload {
  roomId: string;
}

/** Payload de location-update (cliente→servidor). */
interface LocationUpdatePayload {
  roomId: string;
  lng: number;
  lat: number;
  accuracy?: number;
  battery?: number;
}

/**
 * Gateway de tiempo real.
 *
 * CORS abierto en desarrollo (cors.origin '*'), coherente con el CORS HTTP abierto
 * (decisión 009). Antes de producción debe restringirse a los orígenes de la app.
 *
 * Autenticación: el JWT del handshake se valida en handleConnection con el
 * JwtService global (decisión 021). Si es inválido/ausente, se desconecta el socket.
 * El sub queda en socket.data.userId. El WsJwtGuard revalida cada evento por
 * defensa en profundidad.
 */
@UseGuards(WsJwtGuard)
@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private readonly server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly roomsService: RoomsService,
    private readonly locationsService: LocationsService,
  ) {}

  /** Valida el JWT del handshake; desconecta si no es válido. */
  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const userId = await WsJwtGuard.resolveUserId(client, this.jwtService);
    if (!userId) {
      this.logger.warn(`Socket ${client.id} rechazado: handshake sin JWT válido`);
      client.emit('error', { message: 'No autorizado' });
      client.disconnect(true);
      return;
    }
    client.data.userId = userId;
  }

  /**
   * join-room: valida pertenencia y une el socket al room de Socket.IO
   * (nombre del room = roomId). Rechaza con `error` si no es miembro.
   */
  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: RoomPayload,
  ): Promise<void> {
    const userId = client.data.userId;
    const roomId = payload?.roomId;
    if (!userId || !roomId) {
      client.emit('error', { message: 'Datos incompletos' });
      return;
    }

    const membership = await this.roomsService.getMembership(roomId, userId);
    if (!membership) {
      client.emit('error', { message: 'No perteneces a esta sala' });
      return;
    }

    await client.join(roomId);
  }

  /** leave-room: saca el socket del room. */
  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: RoomPayload,
  ): Promise<void> {
    const roomId = payload?.roomId;
    if (!roomId) {
      client.emit('error', { message: 'Datos incompletos' });
      return;
    }

    await client.leave(roomId);
    // member-left (opcional): avisa a los demás para refrescar el mapa.
    if (client.data.userId) {
      client.to(roomId).emit('member-left', { userId: client.data.userId });
    }
  }

  /**
   * location-update: valida pertenencia y que el miembro tenga sharing === true
   * en esa sala. Persiste la ubicación (LocationsService.upsert) y la retransmite
   * a los DEMÁS miembros del room (no al emisor).
   */
  @SubscribeMessage('location-update')
  async handleLocationUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: LocationUpdatePayload,
  ): Promise<void> {
    const userId = client.data.userId;
    const roomId = payload?.roomId;
    if (
      !userId ||
      !roomId ||
      typeof payload.lng !== 'number' ||
      typeof payload.lat !== 'number'
    ) {
      client.emit('error', { message: 'Datos incompletos' });
      return;
    }

    const membership = await this.roomsService.getMembership(roomId, userId);
    if (!membership) {
      client.emit('error', { message: 'No perteneces a esta sala' });
      return;
    }

    // Respeta sharing: si está en pausa, no se persiste ni se retransmite.
    if (!membership.sharing) {
      return;
    }

    const saved = await this.locationsService.upsert(userId, {
      lng: payload.lng,
      lat: payload.lat,
      accuracy: payload.accuracy,
      battery: payload.battery,
    });

    // Retransmite a los DEMÁS del room (client.to excluye al emisor).
    client.to(roomId).emit('location-update', saved);
  }
}
