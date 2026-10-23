# Park 5th Ward — Shared Map Pilot (GitHub Pages + Cloudflare Worker + D1)

## Objetivo

Continuar con el mismo mapa HTML/JavaScript que ya está en `https://arebaza.github.io/Ward/`, pero guardar la última lista Excel **procesada** y las coordenadas en un almacén común.

- `Load Excel` ➜ analiza `Members` en el navegador, reemplaza el directorio en **Cloudflare D1** e identifica nombre y fecha de actualización.
- `Load coordinates` ➜ guarda las coordenadas válidas que coinciden con domicilios.
- `Place by map click` y `Save coordinates for everyone` ➜ guardan inmediatamente la ubicación en D1.
- Cualquier persona que ingrese con la contraseña compartida descarga la última lista y ubicaciones cuando entra o elige `Refresh shared data`.
- Al subir otro Excel, las coordenadas anteriores **se mantienen por domicilio normalizado**.
- **Los archivos Excel originales NO se suben** como binarios: se almacenan los registros procesados (nombres, direcciones, teléfonos, etc.) en el backend. El nombre del último archivo queda registrado.

## Arquitectura

```
Visual Studio Code  ──git push──>  GitHub (arebaza/Ward, sitio público)
                                           │
                                           ▼
                     https://arebaza.github.io/Ward/
                            HTML + CSS + app.js
                                   │ HTTPS
                                   ▼
                    Cloudflare Worker (API privada)
                         Clave protegida en Secret
                                   │
                                   ▼
                      Cloudflare D1 (datos reales)
                        Última lista + coordenadas
```

GitHub Pages sirve archivos estáticos: por sí solo no puede guardar datos compartidos ni protegerlos con una contraseña definida en JavaScript.

## Instalación — 1. Subir código a GitHub

1. Extrae este ZIP.
2. Abre la carpeta en Visual Studio Code.
3. Copia **los archivos y la carpeta `backend`** a la raíz de tu repositorio local `Ward` (sobrescribe el código viejo).
4. Comprueba que `.gitignore` excluya Excel/CSV/secretos. **NO** subas el Excel real ni los JSON exportados del directorio.
5. **No subas todavía** si agregaste miembros reales a archivos fuente. Este ZIP contiene solamente miembros ficticios.

## Instalación — 2. Crear backend Cloudflare

Necesitas una cuenta Cloudflare, Node.js y acceso a la terminal (PowerShell) de VS Code.

1. Abre `Terminal → New Terminal` en VS Code.
2. Entra en la carpeta backend:

```powershell
cd backend
```

3. Inicia sesión (se abrirá navegador):

```powershell
npx wrangler login
```

4. Crea una base de datos (solo una vez):

```powershell
npx wrangler d1 create park5-ward-db
```

5. Copia el `database_id` (UUID) mostrado y reemplaza `REPLACE_WITH_DATABASE_ID` en `backend/wrangler.toml`. No cambies `binding = "DB"`.
6. Crea tablas **en la base de datos remota**:

```powershell
npx wrangler d1 execute park5-ward-db --remote --file=./schema.sql
```

7. Publica el Worker:

```powershell
npx wrangler deploy
```

8. Configura la contraseña del piloto como un **secreto del servidor**, no en `app.js`:

```powershell
npx wrangler secret put PILOT_PASSWORD
```

Cuando Wrangler pregunte el valor, escríbelo en la terminal (no lo agregues a GitHub).

9. Crea una clave aleatoria para firmar sesiones. En otra línea de PowerShell ejecuta:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copia la salida (64 caracteres hexadecimales). Ejecuta:

```powershell
npx wrangler secret put SESSION_SECRET
```

Pega esos 64 caracteres cuando lo solicite. No guardes la clave en el repositorio.

10. Si Wrangler no proporcionó una URL en el primer deploy, vuelve a ejecutar:

```powershell
npx wrangler deploy
```

La URL tendrá la forma:

```
https://park5-map-api.<TU-SUBDOMINIO>.workers.dev
```

Para probar que la API responde (sin datos):

```
https://park5-map-api.<TU-SUBDOMINIO>.workers.dev/api/health
```

Debe aparecer `{"status":"ok"}`.

## Instalación — 3. Conectar GitHub Pages

1. En la **raíz** del proyecto (no en `backend`), abre `config.js`.
2. Reemplaza el marcador de URL con el enlace real de Cloudflare Worker:

```js
window.PARK5_API_URL = "https://park5-map-api.TU-SUBDOMINIO.workers.dev";
```

**La URL pública de la API no es una contraseña.** Se puede subir al repositorio.

3. En VS Code, desde la raíz `Ward`:

```powershell
git add index.html styles.css app.js config.js backend/src/index.mjs backend/schema.sql backend/wrangler.toml README.md SECURITY.md .gitignore .nojekyll
git status
git commit -m "Add password-protected shared directory and saved coordinates"
git push origin main
```

4. Ve a GitHub → `Ward` → Settings → Pages → Deploy from a branch → `main / (root)`.
5. Espera la ejecución exitosa en GitHub `Actions` y abre `https://arebaza.github.io/Ward/`.

## Flujo de uso

1. Introduce la **contraseña que guardaste en Cloudflare**. La contraseña se comprueba en el servidor.
2. Si nadie ha cargado todavía el directorio, verás las 4 familias ficticias de ejemplo.
3. Haz clic en **Load Excel** y selecciona tu `Park5_Web_Import_Both_Sheets_2026-10-23.xlsx` o el Excel original compatible.
4. El navegador procesa la hoja `Members` y guarda la última versión en Cloudflare D1.
5. Todos los usuarios de la contraseña la verán después de iniciar sesión o de pulsar **Refresh shared data**.
6. Selecciona una casa, abre el editor de coordenadas, o marca `Place by map click` y toca en el mapa. La ubicación se guarda en el servidor, visible para otros tras refrescar.
7. Para coordenadas masivas usa `Load coordinates` y selecciona un CSV/Excel con columnas `address` o `household_id`, `latitude`, `longitude`.
8. El botón **Download coordinates CSV** sirve como copia de respaldo local.

**Nota:** Cada edición de ubicación se guarda inmediatamente. El último Excel reemplaza la lista completa de miembros. La identidad de domicilios depende de la normalización de dirección; cambios de dirección o apartamento pueden necesitar reasignar la ubicación.

## Pruebas

- Dos navegadores diferentes: sesión A carga la lista; sesión B ingresa con la contraseña y comprueba recuentos.
- A marca una dirección; B pulsa **Refresh shared data** y la ve.
- A carga una versión nueva de Excel; B la recupera con **Refresh shared data**.
- Falla el servidor: la web debe mostrar **Not saved**; los datos no deben parecer guardados.

## Notas de seguridad, alcance del piloto

- Sitio GitHub Pages y fuente JS son **públicos**. Nunca hagas commit de datos personales, contraseñas ni tokens.
- Cloudflare D1 sí almacena información personal importada; revisar con los responsables de la información que ese procesador externo y la jurisdicción sean aceptables.
- El password compartido da acceso completo: cualquiera que lo sepa **puede consultar, reemplazar el directorio y modificar ubicaciones**. No hay roles individuales, auditoría de usuarios ni control de ediciones concurrentes.
- El backend limita tamaño de carga y bloquea temporalmente un IP después de cinco intentos fallidos. No es un sistema corporativo de identidad.
- Parte de la navegación y herramientas utiliza bibliotecas de terceros (Leaflet, SheetJS, OpenStreetMap, Google Maps al pedir directions). Evita exponer los datos de menores hasta confirmar autorización de procesamiento y hosting.
- Para mayor seguridad futura, implementar cuentas individuales, roles, auditoría y controles de consentimiento/revisión antes de usar datos reales.

Documentación: https://developers.cloudflare.com/d1/get-started/ y https://developers.cloudflare.com/workers/configuration/secrets/ .
