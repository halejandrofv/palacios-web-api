# Palacios Web API

API de Palacios CPA en Cloudflare Workers con Hono, TypeScript, Drizzle y D1. `POST /api/v1/business-profile` conserva los campos del formulario de Astro y devuelve `201` con `{ "success": true, "referenceId": "BP-20260907-8F3A21" }`. Guarda el perfil antes de esperar el envío interno por Resend. Si el envío falla, el perfil queda en D1 y la respuesta es `500 SUBMISSION_FAILED`.

El controlador valida el contrato HTTP. El servicio de negocio normaliza los datos, coordina los adaptadores y reintenta hasta tres inserciones si la referencia colisiona. El adaptador de correo conserva HTML, texto, imágenes CID, `replyTo` e idempotencia por referencia.

## Desarrollo local

Requiere Node.js 24+ y pnpm. La versión de pnpm está fijada en `package.json`.

```powershell
pnpm install --frozen-lockfile
Copy-Item .dev.vars.example .dev.vars
pnpm db:migrate:local
pnpm dev:mock
```

El Worker escucha en `http://localhost:3000`. La documentación local está en `/api/v1/docs`, `/api/v1/docs-json` y `/api/v1/docs-yaml`. `pnpm dev:mock` guarda los perfiles en D1 local y simula Resend para poder enviar el formulario desde Astro o Swagger sin correos reales. Para probar el envío real, usa `pnpm dev` con una clave y un destinatario de pruebas en `.dev.vars`. `pnpm test:integration` usa una base D1 aislada.

| Configuración                                                      | Uso                                                                                                                                                |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DB`                                                               | Binding D1. Reemplaza el UUID de ejemplo en `wrangler.jsonc` para producción.                                                                      |
| `FRONTEND_ORIGINS`                                                 | Orígenes HTTP(S) exactos separados por comas. `CORS_ORIGINS` sigue admitido como valor alternativo cuando falta la variable principal.             |
| `ENABLE_SWAGGER`                                                   | Controla las rutas de documentación. Producción usa `false`.                                                                                       |
| `RESEND_API_KEY`                                                   | Clave de envío existente. Cárgala como secreto en Cloudflare.                                                                                      |
| `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`, `INTERNAL_NOTIFICATION_EMAIL` | Remitente verificado y buzón interno. Reutiliza los valores del entorno original.                                                                  |
| `BUSINESS_PROFILE_RATE_LIMITER`                                    | Binding nativo de Workers con cinco solicitudes cada 60 segundos. Sustituye `BUSINESS_PROFILE_RATE_LIMIT_TTL` y `BUSINESS_PROFILE_RATE_LIMIT_MAX`. |

Wrangler define el puerto local. D1 sustituye `DATABASE_URL` y Cloudflare proporciona la IP de origen mediante `CF-Connecting-IP`. El Worker ya no necesita `PORT`, `NODE_ENV`, `TRUST_PROXY` ni `BRAND_LOGO_URL`. Las imágenes van dentro del paquete. El rate limit de Cloudflare es aproximado por ubicación. [Rate Limiting en Workers](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)

## Verificación

```powershell
pnpm check
pnpm lint
pnpm format:check
pnpm test
pnpm build
```

`pnpm test` incluye las pruebas de negocio, correo, contrato HTTP e integración con D1 local aislado. Las pruebas usan dobles de Resend. `pnpm build` verifica TypeScript y genera el paquete de Wrangler con `--dry-run`. El Worker utiliza D1 y un envío HTTP por solicitud aceptada, más el binding de rate limit. Revisa las cuotas de Workers y D1 para el tráfico de tu cuenta. [Límites de Workers](https://developers.cloudflare.com/workers/platform/limits/) · [Límites de D1](https://developers.cloudflare.com/d1/platform/limits/)

## Esquema y migraciones

`pnpm db:generate <nombre>` genera SQL y metadatos en `drizzle/` después de editar el esquema. Revisa y versiona ambos archivos y aplica la migración primero con `pnpm db:migrate:local`.

La tabla mantiene sus 19 columnas, UUID, referencia única, índices de fecha y estado, límites de longitud y valores predeterminados. Los timestamps UTC se guardan como milisegundos Unix. `services` usa JSON y su validación de opciones y duplicados sigue en el contrato HTTP. SQLite carece del índice GIN de PostgreSQL sobre ese array. La API escribe esa columna y carece de consultas por servicio. La migración PostgreSQL versionada tampoco contiene el índice de expresión `lower(...)` ni los checks de dominio mencionados en sus pruebas de integración. Revisa cualquier diferencia entre el esquema versionado y el esquema real antes de importar. [Migraciones de D1](https://developers.cloudflare.com/d1/reference/migrations/)

## Trasladar perfiles históricos

1. Haz un respaldo de PostgreSQL y revisa su esquema real. Conserva el respaldo y las tablas históricas en PostgreSQL durante el cambio. El exportador cubre `public.business_profile_submissions`.
2. Desde una cuenta PostgreSQL de solo lectura provisionada en un servicio de conexión de `psql`, exporta a un archivo privado fuera del repositorio. El script emite un `INSERT` por fila, con UUID, referencias, fechas UTC, valores nulos y texto UTF-8 conservados. Si encuentra `services` en SQL `NULL`, detiene la exportación para que puedas revisar esas filas.
3. Prueba el archivo en una D1 local vacía con las migraciones aplicadas. Compara recuentos, referencias y una muestra autorizada. El importador usa inserciones estrictas para hacer visibles los conflictos. Si falla la carga, inspecciona el destino y repite en uno vacío.
4. Durante el corte, pausa las escrituras a NestJS, vuelve a exportar y carga el archivo en una D1 remota vacía y ya migrada. Verifica el resultado antes de redirigir el formulario. Si hay que volver al backend original después de abrir escrituras en D1, conserva y concilia los nuevos perfiles antes de cambiar de nuevo.

```powershell
psql -X -qAt -v ON_ERROR_STOP=1 --dbname "service=palacios_readonly" --file scripts/export-postgres.sql --output "<ruta-privada>/import-business-profiles.sql"
pnpm exec wrangler d1 execute DB --local --file "<ruta-privada>/import-business-profiles.sql"
pnpm exec wrangler d1 execute DB --local --command "SELECT COUNT(*) FROM business_profile_submissions"
```

Para la importación aprobada a producción, usa el nombre remoto de la base y `--remote` en lugar de `--local`. El archivo contiene datos personales y se debe tratar como un respaldo. [Importaciones de D1](https://developers.cloudflare.com/d1/best-practices/import-export-data/)

## Despliegue en Cloudflare

```powershell
pnpm exec wrangler login
pnpm exec wrangler d1 create palacios-web-api
```

1. Copia el `database_id` devuelto por Wrangler a `wrangler.jsonc`. Ajusta `namespace_id` si el identificador del limitador ya se usa en tu cuenta.
2. Ejecuta `pnpm db:migrate:remote`. Si hay datos históricos que trasladar, completa primero la verificación y la importación en D1.
3. Prepara un archivo privado `.env.worker.production` con `RESEND_API_KEY`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME` e `INTERNAL_NOTIFICATION_EMAIL` del entorno original. Comprueba que el remitente esté autorizado en Resend. Ejecuta `pnpm run deploy --secrets-file .env.worker.production` para cargar esos valores como secretos. [Secretos en Workers](https://developers.cloudflare.com/workers/configuration/secrets/)
4. En Astro, apunta `PUBLIC_CONSULTATION_ENDPOINT` a la URL HTTPS del Worker seguida de `/api/v1/business-profile`. Vuelve a compilar y publica el frontend cuando hayas verificado el cambio.
