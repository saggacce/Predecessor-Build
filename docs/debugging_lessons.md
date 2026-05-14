# Debugging Lessons — Bugs que costaron más de 3 iteraciones

Cada entrada documenta un bug real que requirió muchas iteraciones para resolver.
Objetivo: que en el futuro se identifique y resuelva en la primera o segunda iteración.

---

## BUG-001 — generalStats vacío en Player Scouting pese a tener MatchPlayer records

**Síntoma**
El perfil de un jugador mostraba `-` en MATCHES, WIN RATE, KDA, HERO DAMAGE.
AVG GPM, AVG DPM, AVG CS y Advanced Metrics sí aparecían.
Hacer Refresh solucionaba el problema.

**Causa raíz (multicapa)**

1. `generalStats` viene del `PlayerSnapshot`. Si el player no tiene snapshot, devuelve `{}`.
2. Se añadió un fallback para calcular `generalStats` desde los `MatchPlayer` ya cargados en la query.
3. El fallback se implementó como IIFE (función autoinvocada) dentro del objeto `return`. Funcionaba en tests directos pero **tsx tenía cacheado el código anterior** en `~/.cache/tsx`.
4. Aunque el source file estaba actualizado, tsx servía la versión compilada cacheada → el fallback nunca se ejecutaba.

**Diagnóstico**
- Verificar que el player tiene MatchPlayers en DB: `SELECT COUNT(*) FROM "MatchPlayer" WHERE "playerId" = '...'`
- Verificar que el snapshot existe: `SELECT id, "generalStats" FROM "PlayerSnapshot" WHERE "playerId" = '...'`
- Añadir log temporal para confirmar que el código nuevo se ejecuta realmente (no la versión cacheada)
- Confirmar caché tsx: `ls ~/.cache/tsx`

**Solución**
1. Calcular `generalStats` como variable explícita ANTES del return (no como IIFE):
   ```ts
   let computedGeneralStats = snapshotStats;
   if (typeof snapshotStats.matches !== 'number' && player.matchPlayers.length > 0) {
     // calcular desde matchPlayers...
     computedGeneralStats = { matches: mps.length, wins, ... };
   }
   return { ..., generalStats: computedGeneralStats, ... };
   ```
2. Limpiar caché de tsx: `rm -rf ~/.cache/tsx`
3. Añadir limpieza de caché en `serve.sh staging` antes de arrancar el API.

**Archivos afectados**
- `apps/api/src/services/player-service.ts` — función `getPlayerProfile`
- `serve.sh` — comando `staging`: añadir `rm -rf ~/.cache/tsx` antes de iniciar tsx

**Prevención futura**
- Cuando un fix no surte efecto en staging aunque el source esté correcto → sospechar caché de tsx.
- Nunca usar IIFEs en objetos de retorno para lógica importante — usar variables explícitas.
- El `serve.sh staging` ya limpia `~/.cache/tsx` automáticamente desde el fix.

---

## BUG-002 — Staging sirviendo código antiguo tras modificar source

**Síntoma**
Se modifica un archivo TypeScript en `/tmp/riftline-staging/apps/api/src/`.
Se verifica que el source tiene el cambio. El staging API sigue comportándose como antes.

**Causa raíz**
tsx compila TypeScript on-the-fly y cachea el resultado en `~/.cache/tsx`.
El caché es por hash del contenido del archivo. Si tsx tiene una entrada cacheada
para un archivo que ha cambiado externamente (worktree reset), puede servir
la versión antigua si el hash de archivo coincide con alguna entrada previa.

**Diagnóstico**
```bash
ls ~/.cache/tsx              # ver si hay caché
grep "DEBUG" logs/staging.log  # añadir console.log temporal y verificar que se ejecuta
```

**Solución**
```bash
rm -rf ~/.cache/tsx
./serve.sh staging-stop && ./serve.sh staging
```

**Prevención futura**
`serve.sh staging` ya ejecuta `rm -rf ~/.cache/tsx` antes de cada arranque.

---

## BUG-003 — upgrade-insecure-requests en CSP bloquea todas las llamadas fetch en HTTP

**Síntoma**
La app carga (index.html llega al browser) pero se queda en blanco.
`/health` devuelve 200 pero el frontend no renderiza nada.
Las llamadas a la API desde el frontend no llegan al servidor.

**Causa raíz**
Helmet.js incluye `upgrade-insecure-requests` en el Content-Security-Policy por defecto.
Esta directiva ordena al browser convertir todas las peticiones HTTP a HTTPS.
Sin HTTPS configurado, todas las llamadas `fetch()` del frontend fallan silenciosamente.

**Diagnóstico**
```bash
curl -I http://localhost:3001/ | grep -i content-security
# Si aparece upgrade-insecure-requests → ese es el problema
```

**Solución**
```ts
app.use(helmet({
  contentSecurityPolicy: process.env.HTTPS_ENABLED === 'true' ? undefined : false,
}));
```
Activar con `HTTPS_ENABLED=true` en el `.env` de producción cuando haya HTTPS configurado.

**Archivos afectados**
- `apps/api/src/index.ts`

**Prevención futura**
Al desplegar en un nuevo servidor sin HTTPS, establecer `HTTPS_ENABLED=false` (o no establecer).
Activar `HTTPS_ENABLED=true` solo después de configurar SSL/nginx.

---

## BUG-004 — Cookies de sesión rechazadas en HTTP (login redirige a landing)

**Síntoma**
El usuario introduce credenciales correctas, hace click en "Acceder" y vuelve a la landing page.
No aparece ningún error. El login parece completarse pero la sesión no se guarda.

**Causa raíz**
Las cookies de sesión se configuran con `secure: true` en `NODE_ENV=production`.
Los browsers rechazan cookies `Secure` enviadas sobre HTTP (no HTTPS).
La cookie se envía en la respuesta pero el browser la ignora → sesión perdida.

**Diagnóstico**
```bash
# Hacer login y ver headers de respuesta
curl -v -X POST http://servidor/api/internal-auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"...","password":"..."}' 2>&1 | grep -i "set-cookie"
# Si el cookie tiene "Secure" pero el servidor está en HTTP → ese es el problema
```

**Solución**
```ts
const secureCookies = process.env.HTTPS_ENABLED === 'true';
res.cookie(SESSION_COOKIE, token, {
  httpOnly: true,
  sameSite: 'lax',
  secure: secureCookies,  // no NODE_ENV, sino HTTPS_ENABLED
  maxAge: SESSION_MAX_AGE_MS,
});
```

**Archivos afectados**
- `apps/api/src/routes/internal-auth.ts` — función `setSessionCookie`

**Prevención futura**
Igual que BUG-003: la variable `HTTPS_ENABLED=true` controla tanto CSP como cookies seguras.
Nunca basar `secure` en `NODE_ENV === 'production'` — usar la variable explícita.

---

## Regla general de documentación

Cuando un bug requiere **más de 3 iteraciones** para resolverse:
1. Añadir una entrada en este documento con la estructura anterior.
2. Commit en `develop` con mensaje `docs: document BUG-XXX resolution`.
3. La entrada debe incluir: síntoma, causa raíz, diagnóstico, solución, archivos afectados y prevención.
