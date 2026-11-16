/** Posición en vivo de un integrante. */
export interface LivePosition {
  userId: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  at: number; // milisegundos (Date.now)
}

/** Posición tal como se envía a los clientes: incluye si el integrante está conectado ahora. */
export interface MemberPosition extends LivePosition {
  online: boolean;
}
