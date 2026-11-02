# Registro de decisiones técnicas

Cada entrada explica qué se decidió, por qué y qué alternativas se descartaron.

---

## 001 — NestJS + MongoDB para el backend

- **Decisión:** backend en NestJS con MongoDB Atlas, usando Mongoose como ODM.
- **Por qué:**
  - Nest impone una arquitectura modular (módulos, controllers, services) e incluye
    inyección de dependencias, lo que mantiene el código organizado a medida que crece.
  - Nest trae soporte nativo para WebSockets, necesario para la ubicación en vivo.
  - MongoDB tiene consultas geoespaciales nativas (índice `2dsphere`) para fotos y reportes
    en el mapa, e índices TTL para datos que deben expirar solos (reportes, posiciones).
- **Alternativa descartada:** Firebase. Era más rápido de montar, pero se prefirió construir
  y entender el backend completo.

## 002 — pnpm como gestor de paquetes

- **Decisión:** usar pnpm en lugar de npm.
- **Por qué:** instalaciones más rápidas y menor uso de disco.
- **Nota de seguridad:** pnpm bloquea por defecto los scripts que los paquetes ejecutan al
  instalarse, una protección contra ataques a la cadena de suministro. Se aprobaron
  explícitamente solo dos:
  - `@parcel/watcher`: vigilancia de archivos para el modo `--watch`.
  - `unrs-resolver`: resolución de imports usada por el linter.
- **Problema encontrado:** al instalar `class-validator` y `class-transformer` (dependencias
  opcionales de `@nestjs/common`), pnpm creó dos copias de `@nestjs/common` y TypeScript
  marcó tipos incompatibles. Se resolvió con `pnpm dedupe`. Ejecutarlo después de agregar
  paquetes que sean dependencias opcionales de otros.
- **Regla:** no mezclar npm y pnpm. El archivo de bloqueo oficial es `pnpm-lock.yaml`.

## 003 — CommonJS en lugar de ESM

- **Decisión:** el proyecto usa módulos CommonJS.
- **Por qué:** la documentación y el ecosistema de Nest asumen CommonJS. ESM añade fricción
  (extensiones `.js` en los imports, configuración extra de Jest) sin aportar beneficios
  a este proyecto.

## 004 — Validación de variables de entorno con Joi

- **Decisión:** el `.env` se valida al arrancar; si falta una variable obligatoria o tiene
  un formato inválido, la aplicación no inicia.
- **Por qué:** un error de configuración se detecta de inmediato y con un mensaje claro,
  en lugar de aparecer en medio de una petición.
- **Reglas actuales:** `MONGO_URI` obligatoria y con formato `mongodb://` o `mongodb+srv://`;
  `PORT` numérico (3000 por defecto); `NODE_ENV` limitado a `development`, `production` o `test`.

## 005 — `MongooseModule.forRootAsync` en lugar de `forRoot`

- **Decisión:** la conexión a MongoDB se configura con `forRootAsync`, inyectando `ConfigService`.
- **Por qué:** así la URI se lee después de que el `ConfigModule` cargó y validó las variables.
  Con `forRoot` y `process.env` directo, la conexión podría intentarse sin validación previa.
- **Nota:** la conexión se configura una sola vez en el módulo raíz. Cada módulo de negocio
  solo registra sus esquemas con `MongooseModule.forFeature`.

## 006 — Health check con @nestjs/terminus

- **Decisión:** exponer `GET /api/v1/health`, que hace ping a MongoDB con un timeout de 1,5 s.
- **Por qué:** los servicios de despliegue (como Render) consultan esta ruta para saber si la
  app está viva. Responder 503 cuando la base no responde permite detectar que el servidor
  "está arriba" pero no puede trabajar.
- **Verificado:** con conexión responde 200 (`mongodb: up`); sin internet responde 503
  (`mongodb: down`, timeout excedido).

## 007 — Prefijo global `/api/v1`

- **Decisión:** todas las rutas cuelgan de `/api/v1`.
- **Por qué:**
  - `api/` separa las rutas de la API de cualquier otro contenido que el servidor sirva
    en el futuro.
  - `v1` permite publicar una `v2` con cambios incompatibles sin romper las versiones
    instaladas de la app móvil.

## 008 — Validación global de datos de entrada (ValidationPipe)

- **Decisión:** `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted` y `transform`.
- **Por qué:**
  - Cada endpoint valida su entrada con un DTO (class-validator), sin código manual.
  - `whitelist` + `forbidNonWhitelisted` rechazan con 400 los campos no declarados en el DTO.
    Evita, por ejemplo, que un cliente envíe `role: "admin"` al registrarse (asignación masiva),
    y ayuda a detectar errores del frontend como campos mal escritos.
  - `transform` convierte el body en una instancia del DTO y ajusta los tipos.
- **Por qué los DTO son clases y no interfaces:** las interfaces desaparecen al compilar a
  JavaScript. Las clases existen en tiempo de ejecución y guardan los decoradores como
  metadatos, que el `ValidationPipe` lee para validar.
- **Reemplaza:** la validación manual (`requireString`, etc.) de la base Express.

## 009 — Cabeceras de seguridad con Helmet y CORS

- **Decisión:** Helmet activo en todos los entornos; CORS abierto durante el desarrollo.
- **Por qué:** Helmet añade cabeceras que mitigan ataques comunes (clickjacking, sniffing de
  tipo MIME, etc.). CORS abierto facilita probar desde la app Ionic en desarrollo.
- **Pendiente antes de producción:** restringir CORS a los orígenes de la app
  (`http://localhost` en Android y `capacitor://localhost` en iOS).
- **Nota:** fuera de producción se desactiva la Content-Security-Policy de Helmet,
  porque bloquea los scripts de la interfaz de Swagger.

## 010 — Swagger solo fuera de producción

- **Decisión:** la documentación interactiva se publica en `/docs` únicamente si
  `NODE_ENV` no es `production`.
- **Por qué:** la documentación se genera desde el código y siempre está actualizada, pero
  en producción expondría el mapa completo de la API.

## 011 — Separación de módulos `users` y `auth`

- **Decisión:** `users` solo accede a los datos; `auth` contiene registro, login y tokens.
- **Por qué:** cada módulo tiene una sola responsabilidad. `UsersModule` exporta su servicio
  y `AuthModule` lo importa, sin duplicar el acceso a la base.

## 012 — Contraseñas cifradas con bcryptjs

- **Decisión:** se guarda solo el hash (10 rondas de sal), nunca la contraseña.
- **Por qué bcryptjs y no bcrypt:** es JavaScript puro; no compila código nativo, lo que evita
  problemas en Windows y con los bloqueos de build scripts de pnpm.
- **Formato del hash:** `$2b$10$` + sal (22 caracteres) + hash (31 caracteres). La sal viaja
  dentro del hash, por eso no se guarda aparte, y dos usuarios con la misma contraseña tienen
  hashes distintos.
- **Límite:** bcrypt usa solo los primeros 72 bytes. El DTO limita a 72 caracteres; con tildes
  o ñ (2 bytes) una contraseña larga podría superar ese límite. Aceptado para este proyecto.

## 013 — La contraseña nunca sale de la base por defecto

- **Decisión:** el campo `password` tiene `select: false`.
- **Por qué:** ninguna consulta la devuelve por accidente. Solo el login la pide de forma
  explícita con `select('+password')`.
- **Nota:** `select: false` no aplica a lo que devuelve `create()`, por eso el servicio vuelve
  a consultar el usuario antes de retornarlo.

## 014 — Validación en dos capas y correos duplicados

- **DTO:** valida la entrada HTTP y responde 400 con mensajes claros.
- **Esquema:** última barrera; protege la base aunque el dato llegue por otro camino.
- **Correos repetidos:** el servicio normaliza el correo (`trim` + minúsculas) antes de buscar,
  y verifica antes de crear (409). Si dos registros llegan al mismo tiempo, ambos pasarían esa
  verificación, pero el índice `unique` de MongoDB solo deja insertar uno.

  ## 015 — Autenticación con JWT

- **Decisión:** al iniciar sesión, el servidor emite un token JWT firmado con `JWT_SECRET`
  (algoritmo HS256). La app lo enviará en cada petición para identificarse.
- **Por qué JWT:** el servidor no necesita guardar sesiones; verifica la firma del token.
  Además, el mismo token servirá para identificar al usuario en los WebSockets de ubicación.
- **Configuración:** `JwtModule.registerAsync` en `AuthModule`, leyendo clave y duración
  validadas desde el `ConfigService` (mismo patrón que la conexión de Mongoose).
- **Validación de la clave:** `JWT_SECRET` es obligatoria y de al menos 32 caracteres; una clave
  corta se podría adivinar por fuerza bruta. Si se filtra, cambiarla invalida todos los tokens
  emitidos (funciona como "botón de emergencia").

## 016 — El token solo contiene el id del usuario

- **Decisión:** el payload es `{ sub: <id del usuario> }`, más `iat` y `exp` que agrega la librería.
- **Por qué:**
  - El payload de un JWT solo está codificado (Base64), no cifrado: cualquiera puede leerlo.
    Verificado en jwt.io. La firma impide _modificarlo_, no _leerlo_. Por eso nunca va nada secreto.
  - Datos como el nombre o el correo pueden cambiar; el id no. Cuando se necesitan, se consultan
    en la base a partir del id.
  - Un token más pequeño viaja en cada petición.

## 017 — Duración del token: 7 días

- **Decisión:** `JWT_EXPIRES_IN=7d` por defecto (verificado: `exp - iat = 604800` segundos).
- **Por qué:** equilibrio entre comodidad (no pedir la contraseña a cada rato en una app móvil)
  y riesgo: un JWT no se puede revocar, así que un token robado sirve hasta que expira.
- **Alternativa descartada por ahora:** token de acceso corto + _refresh token_ largo. Es más
  seguro, pero añade complejidad que no se necesita en esta etapa.

## 018 — Mismo mensaje para correo inexistente y contraseña incorrecta

- **Decisión:** ambos casos responden 401 con "Correo o contraseña incorrectos", definido en
  una sola constante (`INVALID_CREDENTIALS`).
- **Por qué:** mensajes distintos permitirían a un atacante averiguar qué correos están
  registrados (enumeración de usuarios) y concentrar ataques en ellos.
- **Login sin longitud mínima de contraseña:** el `LoginDto` solo exige texto no vacío
  (máximo 72). Si las reglas del registro cambian en el futuro, los usuarios antiguos podrán
  seguir entrando, y no se revelan las reglas de las contraseñas. El máximo se mantiene para
  evitar que se envíen textos enormes que consuman recursos del servidor.
- **Código de respuesta:** el login responde 200 y no 201 (default de `@Post`), porque no crea
  ningún recurso.

## 019 — La respuesta del login se arma a mano

- **Decisión:** se retorna `{ accessToken, user: { id, name, email } }`, construido campo por campo.
- **Por qué:** el login consulta el usuario con `select('+password')`, así que el documento trae
  el hash. Retornarlo completo lo expondría. Se usa una lista blanca en la salida: solo sale lo
  que se escribe explícitamente, y un campo sensible agregado en el futuro no se filtra por accidente.

## 020 — Lección: un `await` olvidado puede abrir una falla de seguridad

- **Qué pasó:** en una primera versión, `bcrypt.compare(...)` se usó sin `await`. La variable
  guardaba una promesa (siempre "verdadera"), así que la verificación nunca fallaba y cualquier
  contraseña habría permitido entrar.
- **Por qué es peligroso:** no genera ningún error; el código compila y parece funcionar.
- **Cómo se detecta:** la prueba "contraseña incorrecta → 401" es obligatoria en cada cambio
  del login.

## 021 — JwtModule global

- **Decisión:** `JwtModule.registerAsync` con `global: true`.
- **Por qué:** el guard necesita `JwtService` en cualquier módulo. Importar `AuthModule` desde
  `UsersModule` crearía una dependencia circular (`AuthModule` ya importa `UsersModule`).
  Al hacerlo global, `JwtService` está disponible en toda la app, igual que `ConfigService`.

## 022 — Guard propio para rutas protegidas

- **Decisión:** `JwtAuthGuard` (en `src/common/guards/`) lee `Authorization: Bearer <token>`,
  verifica firma y expiración con `verifyAsync` y deja el payload en `request.user`.
- **Por qué un guard propio y no Passport:** son pocas líneas, se entiende todo lo que hace
  y no agrega dependencias. Passport tiene sentido con varias estrategias (Google, Facebook…).
- **Mensajes distintos:** "Debes iniciar sesión" (sin token) y "Sesión inválida o expirada"
  (token inválido o vencido). A diferencia del login, no hay datos que proteger y al frontend
  le sirve distinguir los casos.
- **Verificado:** sin token → 401; token con una letra cambiada → 401 (la firma no coincide);
  token expirado (prueba con `JWT_EXPIRES_IN=30s`) → 401.

## 023 — Tipado de la petición autenticada

- **Decisión:** interfaces `JwtPayload` y `AuthenticatedRequest` (que extiende `Request` de
  Express con `user`), en `src/common/interfaces/`.
- **Por qué:** la regla `noImplicitAny` impide agregar `user` a una petición sin tipo. En vez de
  desactivar la regla, se tipa lo que el guard agrega; así el editor conoce `request.user.sub`.
- **`import type`:** como son interfaces (no existen al ejecutar) y se usan en métodos con
  decoradores, se importan con `import type` cuando están activos `isolatedModules` y
  `emitDecoratorMetadata`.

## 024 — `/users/me` consulta la base aunque el token sea válido

- **Decisión:** el endpoint busca el usuario por el `sub` del token y responde 404 si no existe.
- **Por qué:** un JWT solo garantiza que el servidor lo emitió y que nadie lo modificó.
  No garantiza que el usuario siga existiendo: si se borra, su token sigue siendo válido
  hasta que expire.
