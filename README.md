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

Las rutas con **JWT** requieren la cabecera `Authorization: Bearer <accessToken>`.
En Swagger, usa el botón **Authorize** y pega solo el token.

## Documentación

- API interactiva (solo en desarrollo): `http://localhost:3000/docs`
- Decisiones técnicas: [docs/decisiones.md](docs/decisiones.md)

## Convención de commits

Se usa [Conventional Commits](https://www.conventionalcommits.org/):
`feat:` funcionalidad · `fix:` corrección · `docs:` documentación · `chore:` configuración y dependencias.
