# Nodo API

Backend de **Nodo**, una aplicación móvil para viajar en grupo: familias o amigos que salen en carro, moto o bicicleta y quieren verse en el mapa en tiempo real, llegar hasta cualquier integrante y guardar las fotos del camino.

Este repositorio expone la API REST y el canal de tiempo real (WebSocket) que consume la aplicación móvil [`nodo-app`](../nodo-app).

> Proyecto académico — Ingeniería de Sistemas, ETITC (Bogotá), 2026-2.

---

## Contenido

- [Nodo API](#nodo-api)
  - [Contenido](#contenido)
  - [Funciones](#funciones)
  - [Tecnologías](#tecnologías)
  - [Requisitos](#requisitos)
  - [Instalación](#instalación)
  - [Variables de entorno](#variables-de-entorno)
  - [Comandos](#comandos)
  - [Estructura del proyecto](#estructura-del-proyecto)
  - [API REST](#api-rest)
    - [Salud](#salud)
    - [Autenticación](#autenticación)
    - [Usuarios](#usuarios)
    - [Viajes](#viajes)
    - [Recuerdos](#recuerdos)
  - [Tiempo real (WebSocket)](#tiempo-real-websocket)
    - [Eventos del cliente al servidor](#eventos-del-cliente-al-servidor)
    - [Eventos del servidor al cliente](#eventos-del-servidor-al-cliente)
    - [Dos niveles de almacenamiento](#dos-niveles-de-almacenamiento)
  - [Modelo de datos](#modelo-de-datos)
  - [Seguridad](#seguridad)
  - [Despliegue en Render](#despliegue-en-render)
  - [Limitaciones conocidas](#limitaciones-conocidas)
  - [Autores](#autores)

---

## Funciones

- **Cuentas**: registro e inicio de sesión con correo y contraseña; sesión con JWT.
- **Viajes**: crear un viaje, unirse con un código de 6 caracteres, salir o terminarlo. Un usuario solo puede estar en un viaje activo a la vez.
- **Ubicación en vivo**: cada viaje es una sala de Socket.IO; la posición de un integrante solo la reciben los demás integrantes de ese viaje.
- **Última posición conocida**: respaldo en MongoDB para mostrar dónde estaba alguien que perdió conexión.
- **Recuerdos**: fotos con título y ubicación, compartidas con el grupo. Las imágenes se alojan en Cloudinary.
- **Historial**: viajes terminados de cada usuario, con opción de quitarlos de su propia lista.

## Tecnologías

| Área               | Herramienta                                                           |
| ------------------ | --------------------------------------------------------------------- |
| Framework          | NestJS (TypeScript, CommonJS)                                         |
| Base de datos      | MongoDB Atlas con Mongoose                                            |
| Tiempo real        | Socket.IO (`@nestjs/websockets`)                                      |
| Autenticación      | JWT (`@nestjs/jwt`), contraseñas con `bcryptjs`                       |
| Archivos           | Cloudinary (subida desde memoria con Multer)                          |
| Validación         | `class-validator` + `class-transformer`; variables de entorno con Joi |
| Documentación      | Swagger (`@nestjs/swagger`)                                           |
| Salud y seguridad  | Terminus, Helmet                                                      |
| Gestor de paquetes | pnpm                                                                  |

## Requisitos

- Node.js en una versión LTS reciente (el despliegue corre sobre Node 24).
- pnpm (`npm install -g pnpm`).
- Un clúster de MongoDB Atlas (el plan gratuito es suficiente).
- Una cuenta de Cloudinary (plan gratuito).

## Instalación

```bash
git clone <url-del-repositorio>
cd nodo-api
pnpm install
```

Si pnpm avisa de scripts de instalación ignorados (`ERR_PNPM_IGNORED_BUILDS`), apruébalos con `pnpm approve-builds`.

Crea el archivo `.env` a partir de la plantilla y completa los valores:

```bash
cp .env.example .env
```

Arranca en modo desarrollo:

```bash
pnpm start:dev
```

- API: `http://localhost:3000/api/v1`
- Documentación interactiva: `http://localhost:3000/docs`

## Variables de entorno

La aplicación valida estas variables al arrancar y **no inicia** si falta alguna o tiene un formato incorrecto.

| Variable                | Obligatoria | Descripción                                                                           |
| ----------------------- | ----------- | ------------------------------------------------------------------------------------- |
| `NODE_ENV`              | No          | `development`, `production` o `test`.                                                 |
| `PORT`                  | No          | Puerto HTTP. Por defecto `3000`.                                                      |
| `MONGO_URI`             | Sí          | Cadena de conexión de MongoDB Atlas, incluida la base de datos.                       |
| `JWT_SECRET`            | Sí          | Secreto para firmar los tokens. Mínimo 32 caracteres.                                 |
| `JWT_EXPIRES_IN`        | No          | Duración del token en formato número + unidad (`s`, `m`, `h`, `d`). Por defecto `7d`. |
| `CLOUDINARY_CLOUD_NAME` | Sí          | Nombre de la nube en Cloudinary.                                                      |
| `CLOUDINARY_API_KEY`    | Sí          | Clave de API de Cloudinary.                                                           |
| `CLOUDINARY_API_SECRET` | Sí          | Secreto de API de Cloudinary.                                                         |

Para generar un `JWT_SECRET` seguro:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> **El archivo `.env` nunca se sube al repositorio.** Está en `.gitignore`. Si un secreto se expone (en un chat, una captura o un commit), hay que rotarlo.

## Comandos

| Comando           | Qué hace                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `pnpm start:dev`  | Servidor de desarrollo con recarga automática.                                                                          |
| `pnpm build`      | Compila a `dist/`. Conviene ejecutarlo antes de cada push: detecta errores que el modo desarrollo puede pasar por alto. |
| `pnpm start:prod` | Ejecuta la versión compilada (`node dist/main`), igual que en producción.                                               |
| `pnpm lint`       | Revisa el código con ESLint.                                                                                            |
| `pnpm test`       | Pruebas unitarias.                                                                                                      |

## Estructura del proyecto

```
src/
├── main.ts                      Arranque: prefijo api/v1, Helmet, CORS, validación global, Swagger
├── app.module.ts                Módulo raíz: configuración, conexión a Mongo y módulos de negocio
├── config/
│   └── env.validation.ts        Esquema Joi de las variables de entorno
├── common/
│   ├── decorators/              @CurrentUser(): usuario autenticado en los controladores
│   ├── guards/                  JwtAuthGuard: exige un token válido
│   └── interfaces/              JwtPayload y petición autenticada
└── modules/
    ├── health/                  Comprobación de salud (para Render)
    ├── users/                   Esquema de usuario y consulta del perfil propio
    ├── auth/                    Registro e inicio de sesión
    ├── trips/                   Viajes: crear, unirse, salir, terminar, historial
    ├── tracking/                Gateway de Socket.IO y última posición en Mongo
    └── memories/                Recuerdos (fotos) y servicio de Cloudinary
docs/
└── decisiones.md                Registro de decisiones técnicas y su porqué
```

Cada módulo sigue el mismo patrón: `*.module.ts` (qué se registra), `*.controller.ts` (rutas HTTP), `*.service.ts` (reglas de negocio), `dto/` (datos de entrada validados) y `schemas/` (colecciones de Mongo).

## API REST

Prefijo común: `/api/v1`. Todas las rutas, salvo las de salud y autenticación, requieren la cabecera `Authorization: Bearer <token>`.

La referencia completa, con esquemas y ejemplos, está en Swagger (`/docs`, disponible fuera de producción).

### Salud

| Método | Ruta      | Descripción                                |
| ------ | --------- | ------------------------------------------ |
| GET    | `/health` | Estado del servicio y de la base de datos. |

### Autenticación

| Método | Ruta             | Descripción                                            |
| ------ | ---------------- | ------------------------------------------------------ |
| POST   | `/auth/register` | Crea una cuenta (`name`, `email`, `password`).         |
| POST   | `/auth/login`    | Devuelve `{ accessToken, user: { id, name, email } }`. |

### Usuarios

| Método | Ruta        | Descripción                    |
| ------ | ----------- | ------------------------------ |
| GET    | `/users/me` | Datos del usuario autenticado. |

### Viajes

| Método | Ruta                 | Respuesta | Descripción                                                                            |
| ------ | -------------------- | --------- | -------------------------------------------------------------------------------------- |
| POST   | `/trips`             | 201       | Crea un viaje (`name`, `vehicle`, `destination` opcional). 409 si ya tiene uno activo. |
| POST   | `/trips/join`        | 200       | Se une con `code` y `vehicle`. 404 si el código no existe; 409 si terminó.             |
| GET    | `/trips/active`      | 200       | Viaje activo del usuario. 404 si no tiene.                                             |
| GET    | `/trips/history`     | 200       | Viajes terminados, del más reciente al más antiguo.                                    |
| GET    | `/trips/:id`         | 200       | Detalle de un viaje. Solo integrantes.                                                 |
| POST   | `/trips/:id/leave`   | 204       | Sale del viaje. El creador no puede salir: debe terminarlo.                            |
| POST   | `/trips/:id/end`     | 200       | Termina el viaje. Solo el creador.                                                     |
| DELETE | `/trips/:id/history` | 204       | Quita el viaje del historial de quien lo pide. No lo borra para los demás.             |

Vehículos admitidos: `car`, `motorcycle`, `bicycle`.

Forma de un viaje en las respuestas:

```json
{
  "id": "…",
  "name": "Paseo a Melgar",
  "destination": "Melgar, Tolima",
  "code": "K7M4XP",
  "ownerId": "…",
  "status": "active",
  "members": [
    {
      "userId": "…",
      "name": "Laura",
      "vehicle": "motorcycle",
      "joinedAt": "2026-11-15T14:00:00.000Z"
    }
  ],
  "createdAt": "2026-11-15T14:00:00.000Z",
  "endedAt": null
}
```

### Recuerdos

| Método | Ruta            | Respuesta | Descripción                                                                                    |
| ------ | --------------- | --------- | ---------------------------------------------------------------------------------------------- |
| POST   | `/memories`     | 201       | Sube una foto. `multipart/form-data` con `photo` (archivo), `title`, `lat` y `lng` opcionales. |
| GET    | `/memories`     | 200       | Recuerdos propios y de todos los viajes donde participa el usuario.                            |
| DELETE | `/memories/:id` | 204       | Borra un recuerdo. Solo su autor.                                                              |

Límites de la foto: 5 MB como máximo; formatos JPEG, PNG o WebP.

## Tiempo real (WebSocket)

- **Namespace**: `/tracking`, en el mismo puerto que la API. El prefijo `/api/v1` no aplica a los sockets.
- **Autenticación**: el token se envía en el _handshake_ (`auth: { token }`). Se valida antes de aceptar la conexión; si falla, el cliente recibe `connect_error`.

### Eventos del cliente al servidor

| Evento            | Carga                          | Respuesta (_ack_)                                                                  |
| ----------------- | ------------------------------ | ---------------------------------------------------------------------------------- |
| `trip:join`       | `{ tripId }`                   | `{ ok, positions }` con la última posición de cada integrante y si está conectado. |
| `location:update` | `{ lat, lng, heading, speed }` | `{ ok }`                                                                           |

### Eventos del servidor al cliente

| Evento             | Carga                                              | Cuándo                                  |
| ------------------ | -------------------------------------------------- | --------------------------------------- |
| `location:updated` | `{ userId, lat, lng, heading, speed, at, online }` | Un integrante envió su posición.        |
| `member:offline`   | `{ userId }`                                       | Un integrante cerró su última conexión. |

El cliente debe esperar el _ack_ de `trip:join` antes de enviar posiciones: el servidor descarta las de quien aún no está en la sala.

### Dos niveles de almacenamiento

1. **Memoria**: cada posición recibida. De aquí sale el tiempo real.
2. **MongoDB**: la última posición de cada integrante, como máximo cada 30 segundos y al desconectarse. Sobrevive a reinicios y permite mostrar la última ubicación conocida.

## Modelo de datos

| Colección   | Qué guarda                                                                                                    | Índices relevantes                               |
| ----------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `users`     | Nombre, correo (único, en minúsculas) y contraseña cifrada (no se devuelve en las consultas).                 | `email` único                                    |
| `trips`     | Nombre, destino, código, creador, estado, integrantes (como subdocumentos) y quién lo ocultó de su historial. | `code` único; `{ members.user, status }`         |
| `memories`  | Autor, viaje, título, URL de la imagen en Cloudinary y coordenadas.                                           | `{ user, takenAt }`; `{ trip, takenAt }`         |
| `positions` | Última posición de cada integrante por viaje. Un documento por persona y viaje.                               | `{ trip, user }` único; TTL de 7 días sobre `at` |

Las imágenes no se guardan en MongoDB: solo su URL y su identificador en Cloudinary.

## Seguridad

- Contraseñas cifradas con bcrypt (10 rondas). Nunca se devuelven en las respuestas.
- Mensajes genéricos en el inicio de sesión, para no revelar si un correo está registrado.
- Validación de entrada global: se rechazan propiedades desconocidas (`whitelist` + `forbidNonWhitelisted`).
- Cuando un recurso no pertenece al usuario se responde **404 y no 403**, para no revelar que existe.
- El viaje de un recuerdo lo decide el servidor (el viaje activo del usuario), no el cliente.
- Las posiciones recibidas por socket se validan a mano; la hora la pone el servidor.
- Los códigos de invitación se generan con `crypto.randomInt`, no con `Math.random`.
- Cabeceras de seguridad con Helmet. Swagger se desactiva en producción.

## Despliegue en Render

1. Crear un **Web Service** conectado al repositorio.
2. **Build Command**: `pnpm install && pnpm build`
3. **Start Command**: `pnpm start:prod`
4. **Health Check Path**: `/api/v1/health`
5. Agregar en **Environment** todas las variables de la tabla anterior, con `NODE_ENV=production`.
6. En MongoDB Atlas → _Network Access_, permitir el acceso desde cualquier IP (`0.0.0.0/0`), porque las direcciones de Render cambian.

El plan gratuito de Render suspende el servicio tras un tiempo sin uso: la primera petición después de eso puede tardar cerca de un minuto.

## Limitaciones conocidas

- **Una sola instancia**: las posiciones en vivo están en la memoria del proceso. Para escalar a varias instancias haría falta un adaptador de Socket.IO con Redis.
- **CORS abierto** (`*`), adecuado para una app móvil en desarrollo; en un producto real se restringiría.
- **Sin tokens de renovación**: al vencer el JWT (7 días) el usuario debe iniciar sesión de nuevo.
- **Sin paginación**: el historial y los recuerdos tienen un tope fijo de resultados.
- **Salir de un viaje borra al integrante**: quien se sale antes de que termine no lo verá en su historial.
- **Inicio de sesión con Google**: no implementado.

Las decisiones técnicas y su justificación están en [`docs/decisiones.md`](docs/decisiones.md).

## Autores

- **Santiago Jiménez** — backend e integración.
- **Sebastián Gómez** — interfaz de usuario.
- **Hawi Acevedo** - Testing
  Ingeniería de Sistemas · Escuela Tecnológica Instituto Técnico Central (ETITC) · Bogotá, 2026.
