# Diagnóstico Técnico de Riego — CFI/DGI (versión real con backend)

Esta es la versión real del prototipo: backend en Node.js/Express, base de
datos PostgreSQL, autenticación con JWT y contraseñas hasheadas, subida real
de fotos, y envío de correos por SMTP (con fallback a bandeja interna si
todavía no cargaste las credenciales SMTP).

## 1. Requisitos

- Node.js 18 o superior
- Docker y Docker Compose (para levantar PostgreSQL fácilmente)

## 2. Levantar la base de datos

```bash
docker compose up -d
```

Esto levanta un PostgreSQL en `localhost:5432` con usuario `riego`,
contraseña `riego` y base `riego` (ver `docker-compose.yml`).

Si ya tenés tu propio PostgreSQL, no uses este paso: solo asegurate de que
`DATABASE_URL` en el `.env` apunte a tu instancia.

## 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Editá `.env` y completá al menos `JWT_SECRET` (cualquier cadena larga y
aleatoria). Los campos `SMTP_*` quedaron vacíos a propósito — mientras no los
completes, los correos de notificación se guardan en la base (tabla
`emails`, visible en la bandeja de la app) pero no se envían de verdad.
Cuando tengas tu servidor SMTP (SendGrid, Outlook, etc.), completá:

```
SMTP_HOST=smtp.tu-proveedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu_usuario
SMTP_PASS=tu_contraseña
SMTP_FROM="Diagnóstico Técnico de Riego <no-reply@tudominio.org>"
```

## 4. Instalar dependencias, migrar y sembrar datos demo

```bash
npm install
npm run migrate   # crea las tablas
npm run seed       # crea los 3 usuarios demo + 2 diagnósticos de ejemplo
```

Usuarios demo creados por `npm run seed` (mismas credenciales que el
prototipo original):

| Rol                  | Usuario | Contraseña |
|----------------------|---------|------------|
| Técnico de campo     | aperez  | 1234       |
| Responsable provincial | mgomez | 1234      |
| Técnico CFI          | lcosta  | 1234       |

## 5. Correr la aplicación

```bash
npm start
```

Abrí `http://localhost:3000` en el navegador. El mismo servidor Express
sirve el frontend (carpeta `public/`) y la API (`/api/...`).

Para desarrollo con reinicio automático: `npm run dev` (usa `nodemon`).

## 6. Qué cambió respecto del prototipo

- **Datos persistidos de verdad** en PostgreSQL (antes vivían en memoria del
  navegador y se perdían al recargar la página).
- **Login real**: contraseñas hasheadas con bcrypt, sesión con JWT.
- **Fotos**: subida real de archivos (antes era un casillero que solo se
  marcaba como "cargado"). Se guardan en `server/uploads/<id_diagnostico>/`
  y se sirven en `/uploads/...`.
- **Firma electrónica**: el trazo del canvas se captura como imagen PNG real
  y se guarda junto con hash del contenido, usuario, fecha/hora del
  servidor y geolocalización real del navegador (si el usuario la permite).
- **Reautenticación**: la contraseña se valida contra el hash en el
  servidor antes de aceptar cualquier firma o rechazo.
- **Notificaciones por correo**: integradas con `nodemailer`. Si configurás
  SMTP en `.env`, se envían de verdad; si no, quedan logueadas en la base
  con estado "logged" para no perder trazabilidad.
- **Circuito de firmas y devoluciones**: la lógica de transición de estados
  (borrador → firmado técnico → firmado provincia → validado CFI, y las
  devoluciones/rechazos) vive ahora en el backend, no puede manipularse
  desde el navegador.

## 7. Estructura del proyecto

```
riego-app/
├── docker-compose.yml       # PostgreSQL para desarrollo local
├── .env.example
├── db/
│   └── schema.sql           # esquema de la base
├── server/
│   ├── index.js             # servidor Express (API + estáticos)
│   ├── db.js                # conexión a Postgres
│   ├── auth.js              # JWT + middlewares de rol
│   ├── mailer.js            # nodemailer + bandeja persistida
│   ├── informe.js           # generador del borrador de Conformidad Técnica
│   ├── constants.js         # reglas de completitud / campos obligatorios
│   ├── migrate.js           # aplica db/schema.sql
│   ├── seed.js              # crea usuarios y diagnósticos demo
│   ├── uploads/             # fotos subidas (no se sube a git)
│   └── routes/
│       ├── auth.js
│       ├── diagnosticos.js  # CRUD + workflow de firmas
│       ├── fotos.js         # subida/borrado de fotos
│       └── emails.js        # bandeja de notificaciones
└── public/
    ├── index.html
    ├── styles.css
    └── app.js                # frontend (fetch a la API real)
```

## 8. Notas de seguridad antes de usar en producción

- Cambiá `JWT_SECRET` y las contraseñas demo antes de exponer esto fuera de
  tu red local.
- Este proyecto no incluye HTTPS ni rate limiting — si lo vas a desplegar en
  internet, ponelo detrás de un proxy (nginx/Caddy) con TLS y agregá algún
  limitador de intentos de login.
- Los archivos subidos no pasan por antivirus ni validación de contenido más
  allá del tipo MIME — considerá agregarlo si vas a producción real.
