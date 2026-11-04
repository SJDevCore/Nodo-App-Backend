# nodo-api

Backend de una app móvil de viajes grupales. Familias y amigos que se desplazan en varios
vehículos (carro o moto) ven en un mismo mapa la ubicación en vivo de cada integrante,
el rastro de su recorrido, reportes rápidos del grupo (tráfico, accidentes, paradas, retenes)
y fotos geolocalizadas de los lugares por donde pasan.

El frontend es una app en Ionic + Angular + Capacitor (repositorio aparte).

## Tecnologías

- **NestJS** (TypeScript, CommonJS)
- **MongoDB Atlas** con **Mongoose**
- **@nestjs/config + Joi** para variables de entorno validadas
- **class-validator + class-transformer** para validar los datos de entrada
- **bcryptjs** para cifrar contraseñas
- **@nestjs/jwt** para la autenticación con tokens JWT
- **Helmet** para cabeceras de seguridad
- **Swagger (@nestjs/swagger)** para la documentación interactiva
- **@nestjs/terminus** para el health check
- **pnpm** como gestor de paquetes

## Requisitos

- Node.js 20 o superior
- pnpm
- Un cluster en MongoDB Atlas (o MongoDB local)

## Instalación

```bash
pnpm install
cp .env.example .env   # luego completa las variables
```

- El archivo `.env` **no está en el repositorio** (contiene credenciales). Se crea en cada equipo
  a partir de `.env.example`.
- En MongoDB Atlas → **Network Access**, autoriza la IP del equipo donde corre la app.
- Si pnpm muestra el aviso de _build scripts_ ignorados, ejecuta `pnpm approve-builds`
  (ver la decisión 002 en `docs/decisiones.md`).

Para generar un `JWT_SECRET` aleatorio:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Ejecución

```bash
pnpm start:dev    # desarrollo, con recarga automática
pnpm build        # compila a dist/
pnpm start:prod   # ejecuta la versión compilada
```

## Variables de entorno

| Variable         | Obligatoria | Descripción                                               |
| ---------------- | ----------- | --------------------------------------------------------- |
| `PORT`           | No (3000)   | Puerto HTTP                                               |
| `NODE_ENV`       | No          | `development`, `production` o `test`                      |
| `MONGO_URI`      | Sí          | Cadena de conexión de MongoDB, con el nombre de la base   |
| `JWT_SECRET`     | Sí          | Clave para firmar los tokens. Mínimo 32 caracteres        |
| `JWT_EXPIRES_IN` | No (`7d`)   | Duración del token. Formato: número + `s`, `m`, `h` o `d` |

La app valida estas variables al arrancar y **no inicia** si falta alguna obligatoria
o tiene un formato inválido.

## Estructura

```
src/
  main.ts                    → arranque: prefijo /api/v1, Helmet, CORS, validación, Swagger
  app.module.ts              → módulo raíz: config, conexión a MongoDB y módulos
  config/
    env.validation.ts        → esquema Joi de las variables de entorno
  common/
    guards/jwt-auth.guard.ts → protege rutas: verifica el token JWT
    interfaces/              → tipos compartidos (payload del JWT, petición autenticada)
  modules/
    health/                  → health check (estado del servidor y de MongoDB)
    users/
      schemas/user.schema.ts → esquema del usuario
      users.service.ts       → acceso a datos de usuarios
      users.controller.ts    → rutas /users (perfil del usuario autenticado)
    auth/
      dto/register.dto.ts    → validación del registro
      dto/login.dto.ts       → validación del login
      auth.service.ts        → registro y login (cifrado, verificación, emisión del JWT)
      auth.controller.ts     → rutas /auth
    rooms/
      schemas/room.schema.ts        → esquema de la sala (nombre, código único, admin)
      schemas/room-member.schema.ts → membresía (índice único roomId+userId, rol, sharing)
      dto/create-room.dto.ts        → validación al crear sala
      dto/join-room.dto.ts          → validación al unirse con código
      dto/update-sharing.dto.ts     → validación al pausar/reanudar
      rooms.service.ts              → lógica de salas y membresías (getDetail trae la última ubicación)
      rooms.controller.ts           → rutas /rooms
    locations/
      schemas/location.schema.ts    → ubicación GeoJSON por usuario, índice 2dsphere
      dto/update-location.dto.ts    → validación del body { lng, lat, accuracy?, battery? }
      locations.service.ts          → upsert de la última ubicación y consulta por usuarios
      locations.controller.ts       → rutas /locations
    realtime/
      realtime.gateway.ts           → gateway Socket.IO (join-room, leave-room, location-update)
      ws-jwt.guard.ts               → valida el JWT del handshake y de cada evento
      realtime.module.ts            → módulo de tiempo real
  common/
    guards/room-membership.guard.ts → protege rutas de sala: valida que seas miembro
docs/
  decisiones.md              → registro de decisiones técnicas
```

## Endpoints

Base: `http://localhost:3000/api/v1`

| Método | Ruta             | Auth | Descripción                                                                             |
| ------ | ---------------- | ---- | --------------------------------------------------------------------------------------- |
| GET    | `/health`        | —    | Estado del servidor y de MongoDB. 200 si todo está bien, 503 si la base no responde     |
| POST   | `/auth/register` | —    | Registra un usuario. 201 creado · 400 datos inválidos · 409 correo repetido             |
| POST   | `/auth/login`    | —    | Inicia sesión. 200 con `accessToken` y datos del usuario · 401 credenciales incorrectas |
| GET    | `/users/me`      | JWT  | Perfil del usuario autenticado. 200 · 401 sin token o inválido · 404 usuario borrado    |

**Salas** (todas requieren JWT):

| Método | Ruta                          | Auth          | Descripción                                                                      |
| ------ | ----------------------------- | ------------- | -------------------------------------------------------------------------------- |
| POST   | `/rooms`                      | JWT           | Crea una sala; genera un código de 6 caracteres y deja al creador como admin     |
| GET    | `/rooms`                      | JWT           | Lista las salas a las que perteneces                                             |
| GET    | `/rooms/:id`                  | JWT + miembro | Detalle de la sala con sus integrantes. 403 si no eres miembro · 404 si no existe |
| POST   | `/rooms/join`                 | JWT           | Te une a una sala con su código. 404 código inexistente · 409 ya eres miembro    |
| DELETE | `/rooms/:id/members/:userId`  | JWT + admin   | Expulsa a un integrante. 403 si no eres el admin o intentas expulsarte a ti mismo |
| PATCH  | `/rooms/:id/sharing`          | JWT + miembro | Pausa o reanuda tu compartir en esa sala                                         |

**Ubicaciones** (requiere JWT):

| Método | Ruta         | Auth | Descripción                                                                                       |
| ------ | ------------ | ---- | ------------------------------------------------------------------------------------------------- |
| POST   | `/locations` | JWT  | Registra (upsert) tu última ubicación. Una por usuario; `updatedAt` marca cuándo se actualizó     |

Las rutas con **JWT** requieren la cabecera `Authorization: Bearer <accessToken>`.
En Swagger, usa el botón **Authorize** y pega solo el token.

## Ejemplos de uso

Base: `http://localhost:3000/api/v1`. En los ejemplos, `$TOKEN` es el `accessToken`
que devuelve `POST /auth/login` y `$ROOM` es el `id` de una sala.

### Autenticación (previo a todo)

```bash
# Registro
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{ "name": "Ana", "email": "ana@example.com", "password": "secreto123" }'

# Login → copia el accessToken de la respuesta
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "ana@example.com", "password": "secreto123" }'
```

Respuesta del login:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": "66f0a1...", "name": "Ana", "email": "ana@example.com" }
}
```

### Crear una sala — `POST /rooms`

```bash
curl -X POST http://localhost:3000/api/v1/rooms \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Viaje a la playa" }'
```

```json
{
  "id": "66f0b2...",
  "name": "Viaje a la playa",
  "code": "K7M2PQ",
  "adminId": "66f0a1...",
  "createdAt": "2026-11-03T15:04:00.000Z"
}
```

`name` es obligatorio (máx. 60 caracteres). El `code` se genera solo y es el que
compartes para que otros se unan.

### Listar mis salas — `GET /rooms`

```bash
curl http://localhost:3000/api/v1/rooms \
  -H "Authorization: Bearer $TOKEN"
```

```json
[
  {
    "id": "66f0b2...",
    "name": "Viaje a la playa",
    "code": "K7M2PQ",
    "adminId": "66f0a1...",
    "createdAt": "2026-11-03T15:04:00.000Z"
  }
]
```

### Unirse a una sala — `POST /rooms/join`

```bash
curl -X POST http://localhost:3000/api/v1/rooms/join \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "code": "K7M2PQ" }'
```

Devuelve los datos de la sala a la que te uniste. `code` debe tener 6 caracteres.
Errores: `404` si el código no existe, `409` si ya eres miembro de esa sala.

### Detalle de la sala con integrantes — `GET /rooms/:id`

```bash
curl http://localhost:3000/api/v1/rooms/$ROOM \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "id": "66f0b2...",
  "name": "Viaje a la playa",
  "code": "K7M2PQ",
  "adminId": "66f0a1...",
  "createdAt": "2026-11-03T15:04:00.000Z",
  "members": [
    {
      "userId": "66f0a1...",
      "name": "Ana",
      "role": "admin",
      "sharing": true,
      "location": {
        "userId": "66f0a1...",
        "lng": -74.08175,
        "lat": 4.60971,
        "accuracy": 12.5,
        "battery": 84,
        "updatedAt": "2026-11-03T15:10:30.000Z"
      }
    },
    {
      "userId": "66f0c3...",
      "name": "Luis",
      "role": "member",
      "sharing": false,
      "location": null
    }
  ]
}
```

Debes ser miembro de la sala; si no, responde `403`.

El campo `location` trae la **última ubicación conocida** de cada integrante con el
compartir activo (`sharing: true`). Si un miembro tiene `sharing: false`, o aún no ha
reportado posición, su `location` es `null`. Las coordenadas siguen la convención
GeoJSON `[lng, lat]`, pero aquí se exponen como `lng` y `lat` por separado.

### Expulsar a un integrante — `DELETE /rooms/:id/members/:userId`

```bash
curl -X DELETE http://localhost:3000/api/v1/rooms/$ROOM/members/66f0c3... \
  -H "Authorization: Bearer $TOKEN"
```

```json
{ "removed": true }
```

Solo el **admin** de la sala puede expulsar, y no puede expulsarse a sí mismo (`403`).
Si el usuario no pertenece a la sala, responde `404`.

### Pausar o reanudar el compartir — `PATCH /rooms/:id/sharing`

```bash
curl -X PATCH http://localhost:3000/api/v1/rooms/$ROOM/sharing \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "sharing": false }'
```

```json
{ "roomId": "66f0b2...", "sharing": false }
```

Afecta solo tu propia membresía en esa sala. `sharing` es un booleano obligatorio.

### Registrar mi ubicación — `POST /locations`

```bash
curl -X POST http://localhost:3000/api/v1/locations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "lng": -74.08175, "lat": 4.60971, "accuracy": 12.5, "battery": 84 }'
```

```json
{
  "userId": "66f0a1...",
  "lng": -74.08175,
  "lat": 4.60971,
  "accuracy": 12.5,
  "battery": 84,
  "updatedAt": "2026-11-03T15:10:30.000Z"
}
```

Es un **upsert**: guarda o reemplaza tu única ubicación. `lng` (−180 a 180) y `lat`
(−90 a 90) son obligatorios; `accuracy` (metros) y `battery` (0 a 100) son opcionales.
Recuerda la convención GeoJSON `[lng, lat]`: la **longitud va primero** y la latitud
después. Este canal HTTP se usa sobre todo para enviar la posición en segundo plano,
cuando el sistema operativo cierra los sockets; en primer plano se usa Socket.IO.

## Tiempo real (Socket.IO)

Además del canal HTTP, el backend expone un gateway **Socket.IO** para compartir la
ubicación en vivo entre los integrantes de una sala. El servidor escucha en la misma
URL que la API (sin el prefijo `/api/v1`):

```
ws://localhost:3000
```

### Conexión y autenticación

El handshake debe llevar el **mismo JWT** que usan las rutas HTTP. Puedes enviarlo en
`auth.token` o en la cabecera `Authorization: Bearer <accessToken>`. Si el token falta
o es inválido, el servidor emite un evento `error` y cierra la conexión.

### Eventos

| Evento            | Sentido           | Payload                                              | Descripción                                                                 |
| ----------------- | ----------------- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| `join-room`       | cliente → servidor | `{ "roomId": "66f0b2..." }`                          | Te une a la sala para recibir sus actualizaciones. Rechaza con `error` si no eres miembro |
| `leave-room`      | cliente → servidor | `{ "roomId": "66f0b2..." }`                          | Sales de la sala; avisa a los demás con `member-left`                       |
| `location-update` | cliente → servidor | `{ "roomId": "66f0b2...", "lng": -74.08175, "lat": 4.60971, "accuracy": 12.5, "battery": 84 }` | Persiste tu ubicación y la retransmite a los demás. Se ignora si tienes `sharing: false` |
| `location-update` | servidor → cliente | `{ "userId": "66f0a1...", "lng": -74.08175, "lat": 4.60971, "accuracy": 12.5, "battery": 84, "updatedAt": "2026-11-03T15:10:30.000Z" }` | Llega cuando otro integrante de la sala actualiza su posición (no te llega la tuya) |
| `member-left`     | servidor → cliente | `{ "userId": "66f0c3..." }`                          | Un integrante salió de la sala; útil para refrescar el mapa                 |
| `error`           | servidor → cliente | `{ "message": "No perteneces a esta sala" }`         | Datos incompletos, sala no autorizada o handshake sin JWT válido            |

En `location-update` el servidor respeta el `sharing` de tu membresía: si lo tienes en
pausa, tu posición no se guarda ni se reparte. La retransmisión excluye al emisor, así
que no recibes copia de tus propias actualizaciones.

### Ejemplo de cliente (socket.io-client)

```js
import { io } from 'socket.io-client';

// El JWT es el accessToken que devuelve POST /auth/login
const socket = io('http://localhost:3000', {
  auth: { token: accessToken },
});

socket.on('connect', () => {
  // Únete a la sala para empezar a recibir ubicaciones
  socket.emit('join-room', { roomId: '66f0b2...' });

  // Envía tu posición (convención GeoJSON: lng primero, lat después)
  socket.emit('location-update', {
    roomId: '66f0b2...',
    lng: -74.08175,
    lat: 4.60971,
    accuracy: 12.5,
    battery: 84,
  });
});

// Posición de otro integrante de la sala
socket.on('location-update', (location) => {
  console.log('Nueva posición', location);
});

// Un integrante salió de la sala
socket.on('member-left', ({ userId }) => {
  console.log('Salió', userId);
});

// Errores (no autorizado, datos incompletos, etc.)
socket.on('error', (err) => {
  console.warn('Error del socket', err.message);
});
```

## Probar en local (demo de tiempo real)

El repositorio incluye un cliente de prueba listo para usar en
[`examples/socket-client.html`](examples/socket-client.html). Es una página con **3
paneles** (3 usuarios independientes) que permite registrarse, crear/unirse a una sala,
conectar el socket y enviar la ubicación —de forma **manual** o **simulando movimiento**—
para ver los `location-update` llegar entre usuarios en tiempo real.

- **No necesita servidor propio:** se abre con doble clic en el navegador.
- **Funciona sin internet:** la librería `socket.io-client` va incluida en
  `examples/vendor/`, no se descarga de ningún CDN.

### Pasos

1. Levanta el backend con MongoDB conectado (`MONGO_URI` en tu `.env`):

   ```bash
   pnpm start:dev
   ```

   El servidor queda en `http://localhost:3000`.

2. Abre `examples/socket-client.html` en el navegador (doble clic).

3. Sigue el flujo en los paneles:
   - **Panel 1:** _Registrar_ → _Login_ → _Crear sala_ → copia el código que aparece.
   - **Paneles 2 y 3:** _Registrar_ → _Login_ → pega el código en _Unirse_.
   - En los 3 paneles: _Conectar socket_ (hace `join-room` automáticamente).
   - En cualquier panel: _Enviar ubicación_ (manual) o _Simular movimiento_ (envía una
     posición cada 2 s). Verás las posiciones aparecer en el log de los otros paneles.

> El log de cada panel muestra en verde lo que **recibe** de otros usuarios, en azul lo
> que **envía** y en rojo los errores. Si pausas tu `sharing` (vía
> `PATCH /rooms/:id/sharing`), tu posición deja de retransmitirse a los demás.

### Probar desde un móvil en la misma red

Cambia el campo **Backend** del cliente (o la URL en tu app) de `http://localhost:3000`
a la **IP de tu máquina** en la red local, por ejemplo `http://192.168.1.20:3000`. El
CORS está abierto en desarrollo, así que el dispositivo podrá conectarse sin ajustes
adicionales. (`localhost` desde el móvil apunta al propio teléfono, no a tu equipo.)

## Documentación

- API interactiva (solo en desarrollo): `http://localhost:3000/docs`
- Decisiones técnicas: [docs/decisiones.md](docs/decisiones.md)

## Convención de commits

Se usa [Conventional Commits](https://www.conventionalcommits.org/):
`feat:` funcionalidad · `fix:` corrección · `docs:` documentación · `chore:` configuración y dependencias.
