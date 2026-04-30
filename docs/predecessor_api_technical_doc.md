# Documento Técnico: API de pred.gg (Predecessor)
## Referencia de integración para plataforma de scouting, análisis competitivo y build intelligence

---

## 0. Propósito de este documento

Este documento cubre **la capa de integración de API** (GraphQL/OAuth2, queries, límites y consideraciones técnicas).

No reemplaza la especificación de producto. La visión, alcance y roadmap funcional viven en `docs/project_predecessor.md`.

Prioridad actual del producto:
1. Seguimiento de jugadores.
2. Scouting de jugadores rivales.
3. Análisis de equipos para scrims y partidos.
4. Build/stat calculator como fase posterior.

---

## Índice

1. [Visión general de la API](#1-visión-general)
2. [Autenticación](#2-autenticación)
3. [Schema GraphQL completo](#3-schema-graphql-completo)
4. [Módulo 1: Seguimiento y análisis de jugadores](#4-módulo-1-seguimiento-y-análisis-de-jugadores)
5. [Módulo 2: Análisis de partidas](#5-módulo-2-análisis-de-partidas)
6. [Módulo 3: Scouting de jugadores](#6-módulo-3-scouting-de-jugadores)
7. [Módulo 4: Equipos](#7-módulo-4-equipos)
8. [Módulo 5: Héroes y estadísticas por parche](#8-módulo-5-héroes-y-estadísticas-por-parche)
9. [Módulo 6: Ítems y crests por parche](#9-módulo-6-ítems-y-crests-por-parche)
10. [Módulo 7: Build Calculator](#10-módulo-7-build-calculator)
11. [Módulo 8: Análisis de rivales](#11-módulo-8-análisis-de-rivales)
12. [Arquitectura recomendada](#12-arquitectura-recomendada)
13. [Consideraciones técnicas](#13-consideraciones-técnicas)
    - 13.1 Limitaciones conocidas
    - 13.2 País del jugador
    - 13.3 Manejo de errores
    - 13.4 Paginación
    - **13.5 Rate Limiting (probado)**
    - **13.6 Política de uso y registro de aplicaciones**
    - 13.7 Algoritmo de diff entre parches

---

## 1. Visión General

- **Tipo de API:** GraphQL (única)  
- **Endpoint:** `https://pred.gg/gql`  
- **Método HTTP:** `POST`  
- **Content-Type:** `application/json`  
- **Autenticación:** Bearer token OAuth2 (ver sección 2)
- **Rate limiting:** Sin límites documentados ni headers de throttling. Probado: 50 requests concurrentes → 100% 200 OK, ~38ms avg. Recomendado auto-limitar a 10 req/s por cortesía
- **Héroes disponibles:** 51  
- **Ítems disponibles:** 281  
- **Versiones/parches registradas:** 144 (desde noviembre 2022)  
- **Temporadas de ranked:** S0, S1S1, S1S2, S1S3, S1S4 (actual, `ratingId: "11"`)  
- **Equipos registrados en la plataforma:** 320

### Enumeraciones globales importantes

```
GameMode:   NONE, STANDARD, PRACTICE, CUSTOM, SOLO, RANKED, TUTORIAL,
            ARENA, TEAM_VS_AI, RUSH, TEAM_VS_AI_RUSH, LEGACY, ARAM, DAYBREAK

Role:       JUNGLE, SUPPORT, CARRY, OFFLANE, MIDLANE

Region:     EUROPE, NA_EAST, NA_WEST, SOUTH_AMERICA, OCEANIA, MIDDLE_EAST, ASIA, (etc.)

PatchType:  CONTENT, BALANCE, HOTFIX

PlayerIntervalStatisticInterval: DAY, WEEK, MONTH, QUARTER, YEAR

HeroLeaderboardTimeframe: ALL_TIME, LAST_30_DAYS
HeroLeaderboardScope:     NONE, DIAMOND_OR_HIGHER
HeroLeaderboardSortCol:   WINRATE, MATCHES_PLAYED

LeaderboardRatingType: (valores del sistema de ranking por temporada)
```

---

## 2. Autenticación

### Mecanismo

pred.gg usa **OAuth2** con tokens almacenados en `localStorage` del navegador. La aplicación debe implementar el flujo OAuth2 contra pred.gg.

### Variables en localStorage (referencia de cómo funciona el cliente web)

```javascript
localStorage.getItem('oauth_access_token')    // JWT Bearer token (~610 chars)
localStorage.getItem('oauth_refresh_token')   // Token de refresco
localStorage.getItem('oauth_token_expires_at') // Timestamp Unix (ms) de expiración
localStorage.getItem('oauth_token_issued_at')  // Timestamp Unix (ms) de emisión
```

### Uso en peticiones

```javascript
// Cada petición GraphQL debe incluir este header:
headers: {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${access_token}`
}
```

### Función auxiliar recomendada para la app

```javascript
async function gql(query, variables = {}) {
  const token = await getValidToken(); // Implementar refresh automático
  const res = await fetch('https://pred.gg/gql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ query, variables })
  });
  const data = await res.json();
  if (data.errors) throw new Error(data.errors[0].message);
  return data.data;
}
```

### Endpoints OAuth2 a investigar (flujo estándar)

La app debe redirigir al usuario a pred.gg para autenticarse. La mutation `authorize` del schema acepta:
```graphql
mutation {
  authorize(clientId: "TU_CLIENT_ID", scope: "...", consent: true) {
    # AuthorizeResult
  }
}
```
Para producción se necesita registrar una aplicación (existe la query `application` y mutation `createApplication`).

---

### 2.1 Hallazgos de autenticación (probado)

> Pruebas realizadas con la Application registrada en pred.gg (APP_ID: HiDUme4).

#### Resultado por método

| Método | HTTP | Resultado | Notas |
|--------|------|-----------|-------|
| Sin header de auth | 200 | ✅ Datos públicos accesibles | Heroes, items, patches funcionan |
| `X-Api-Key: <clientSecret>` | 200 | ✅ Mismo acceso público | Recomendado para producción (rate limits) |
| `Authorization: Basic base64(clientId:clientSecret)` | 401 | ❌ Rechazado | El middleware HTTP rechaza Basic auth |
| `Authorization: Bearer <clientSecret>` | 401 | ❌ Rechazado | El middleware HTTP rechaza Bearer con el secret |
| Mutation `authorize` (sin sesión de usuario) | 200 | ❌ `Forbidden` | Requiere sesión de usuario activa — no sirve para scripts |
| `playersPaginated` (con o sin X-Api-Key) | 200 | ❌ `Forbidden` | Requiere OAuth de usuario — no disponible server-side |
| `leaderboardPaginated` (con o sin X-Api-Key) | 200 | ❌ `Forbidden` | Requiere OAuth de usuario — no disponible server-side |

> **Limitación resuelta (2026-04-30):** Player search requería OAuth2, ahora implementado. Datos de jugadores y estadísticas accesibles con Bearer token de usuario.

### 2.2 Flujo OAuth2 correcto (PKCE) — ✅ Implementado y funcionando

#### Descubrimiento clave

**No redirigir a `/api/oauth2/authorize` directamente.** El flujo debe empezar en la ruta SPA de pred.gg (`/oauth2/authorize`), que añade el token de sesión del usuario antes de llamar a la API interna.

```
Nuestro app → https://pred.gg/oauth2/authorize?client_id=...&code_challenge=...&code_challenge_method=S256
  → El frontend de pred.gg añade el token de sesión del usuario
  → pred.gg llama internamente a /api/oauth2/authorize?...&token=<sesión>
  → pred.gg redirige a nuestro callback: http://localhost:3001/auth/callback?code=...&state=...
  → POST https://pred.gg/api/oauth2/token  (grant_type=authorization_code + code_verifier)
  → Devuelve access_token + refresh_token
  → Bearer token guardado en cookie HTTP-only
  → playersPaginated, heroStatistics, etc. funcionan con Authorization: Bearer <token>
```

#### Variables de entorno para el flujo OAuth2

```
PRED_GG_AUTHORIZE_URL=https://pred.gg/oauth2/authorize      ← SPA route, NOT /api/
PRED_GG_TOKEN_URL=https://pred.gg/api/oauth2/token
PRED_GG_TOKEN_URL_FALLBACK=https://pred.saibotu.de/api/oauth2/token
PRED_GG_OAUTH_SCOPES=offline_access profile player:read:interval hero_leaderboard:read matchup_statistic:read
PRED_GG_CLIENT_AUTH_METHOD=auto  ← prueba Basic, body, y público PKCE automáticamente
PRED_GG_CALLBACK_URL=http://localhost:3001/auth/callback
```

#### Implementación en el backend (`apps/api/src/routes/auth.ts`)

- **PKCE (RFC 7636):** `code_verifier` generado con 64 bytes random, `code_challenge` = SHA256 en base64url
- **State:** 16 bytes random para protección CSRF
- **Cookies:** `predgg_state` y `predgg_code_verifier` en HTTP-only cookies (5 min TTL) para el callback
- **Token exchange:** multi-intento — prueba pred.gg y saibotu con variantes de autenticación (Basic, body, público) hasta obtener `access_token`
- **Scopes obtenidos:** `offline_access profile player:read:interval hero_leaderboard:read matchup_statistic:read`

#### Rutas OAuth2 disponibles

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/auth/predgg` | GET | Inicia login → redirige a pred.gg |
| `/auth/callback` | GET | Recibe código → intercambia por token → cookie |
| `/auth/me` | GET | `{ authenticated: bool }` |
| `/auth/logout` | POST | Limpia cookies |
| `/auth/refresh` | POST | Renueva access_token con refresh_token |

#### Conclusión para el worker de datos

Los datos públicos del juego (heroes, items, perks, versions) son accesibles **sin autenticación**. Las búsquedas y datos de jugadores siguen requiriendo OAuth de usuario. Para producción, enviar el `clientSecret` como `X-Api-Key` solo identifica la aplicación y puede ayudar con rate limiting, pero no sustituye el Bearer token del usuario.

```python
# Modo recomendado para el data sync worker
headers = {
    "Content-Type": "application/json",
    "X-Api-Key": PREDGG_CLIENT_SECRET,  # del .env
}
```

#### Sobre el mutation `authorize`

Schema confirmado por introspección:

```graphql
# Argumentos reales (confirmados)
mutation Authorize($clientId: String!, $scope: String!, $consent: Boolean!) {
  authorize(clientId: $clientId, scope: $scope, consent: $consent) {
    application { id name }   # tipo Application
    token                     # String — JWT de sesión de usuario
  }
}
```

**Este mutation es para flujos OAuth2 interactivos de usuario** (equivalente a "Iniciar sesión con pred.gg"). Devuelve `Forbidden` si se llama desde un script sin sesión de usuario, independientemente del valor de `scope`. No usar en el worker de datos ni en la API backend.

#### Variables de credenciales (`.env`)

```
PREDGG_APP_ID=HiDUme4
PREDGG_CLIENT_ID=l5vdyvqawgovh2qptnumwrsb11ufanyf
PREDGG_CLIENT_SECRET=<client_secret>
```

---

## 3. Schema GraphQL Completo

### 3.1 Queries disponibles (35 total)

| Query | Parámetros | Retorna | Descripción |
|-------|-----------|---------|-------------|
| `currentUser` | — | `User` | Usuario autenticado actual |
| `player` | `by: PlayerKey` | `Player` | Jugador por ID o nombre |
| `players` | `by: [PlayerKey!]!` | `[Player]` | Múltiples jugadores |
| `playersPaginated` | `filter: PlayerFilterInput, limit, offset` | `PaginatedPlayers` | Búsqueda paginada |
| `hero` | `by: HeroKey` | `Hero` | Héroe por slug o id |
| `heroes` | — | `[Hero]` | Todos los héroes |
| `item` | `by: ItemKey` | `Item` | Ítem por id/slug |
| `items` | — | `[Item]` | Todos los ítems |
| `perk` | `by: PerkKey` | `Perk` | Crest por id/slug |
| `perks` | — | `[Perk]` | Todos los crests |
| `match` | `by: MatchKey` | `Match` | Partida por id/uuid |
| `leaderboardPaginated` | `ratingId, ratingType, limit, offset, filter` | `PaginatedLeaderboard` | Clasificación ranked |
| `ratings` | — | `[Rating]` | Todas las temporadas |
| `rating` | `by: RatingKey` | `Rating` | Temporada específica |
| `version` | `by: VersionKey` | `Version` | Parche por id |
| `versions` | — | `[Version]` | Todos los parches |
| `team` | `id: ID` | `Team` | Equipo por id |
| `teams` | — | `[Team]` | Todos los equipos |
| `guide` | `by: GuideKey` | `Guide` | Guía de héroe |
| `guidesPaginated` | `filter, order, limit, offset` | `PaginatedGuides` | Guías paginadas |
| `event` | `by: EventKey` | `Event` | Evento/torneo |
| `events` | `filters: EventFiltersInput` | `[Event]` | Lista de eventos |
| `group` | `id: ID` | `Group` | Grupo de usuarios |
| `groups` | — | `[Group]` | Todos los grupos |
| `prediction` | `id: ID` | `Prediction` | Pick'em predicción |
| `rating` | `by: RatingKey` | `Rating` | Rating específico |
| `ratingStatistic` | `ratingId, granularity, filter` | `RatingStatisticResult` | Estadísticas de rating |
| `backend` | — | `Backend` | Info del servidor |
| `connectionInfo` | — | `ConnectionInfo` | IP y país del cliente |
| `currentAuth` | — | `Authorization` | Auth actual |
| `comment` | `id: ID` | `Comment` | Comentario |
| `communityChallenge` | `id: Int` | `CommunityChallenge` | Reto comunidad |
| `matchSpoilerBlocks` | `includeRejected` | `[MatchSpoilerBlock]` | Bloques spoiler |
| `application` | `id: ID` | `Application` | App OAuth registrada |
| `applicationsPaginated` | `limit, offset` | `PaginatedApplications` | Apps paginadas |

### 3.2 Filtros clave

**PlayerFilterInput:**
```graphql
filter: { search: "nombre_jugador" }  # Campo requerido
```

**LeaderboardFilterInput:**
```graphql
filter: {
  # Sin campos conocidos adicionales en la versión actual
}
```

**HeroGeneralStatisticFilterInput:**
```graphql
filter: {
  gameModes: [RANKED, STANDARD]   # Lista de GameMode
  ranks: ["Paragon", "Diamond"]   # Lista de nombres de rank
  roles: [SUPPORT, JUNGLE]        # Lista de Role
  versions: ["143", "141"]        # Lista de IDs de versión
  matchup: { ... }                # HeroGeneralStatMatchupFilterInput
}
```

**PlayerMatchesFilterInput:**
```graphql
filter: {
  gameModes: [RANKED]
  heroes: ["dekker"]              # slugs de héroes
  roles: [SUPPORT]
  versions: ["143"]
}
```

---

## 4. Módulo 1: Seguimiento y Análisis de Jugadores

### 4.1 Tipo `Player` — campos completos

```
id, name, uuid, favRole, firstPlayedAt, lastPlayedAt
blockName, blockSearch, isBlocked, isNameConsole
friendCode, friendCodePublic, showSocial, showStream, userPublic
canEditFriendcode, canEditName
console (platform indicator)
user → User (cuenta vinculada)
customization → PlayerCustomization
favHero → Hero
favRegion → Region
```

### 4.2 Estadísticas generales del jugador

```graphql
query PlayerGeneral($playerId: ID!) {
  player(by: { id: $playerId }) {
    id name uuid favRole firstPlayedAt lastPlayedAt
    
    generalStatistic(filter: {}) {
      result {
        matchesPlayed matchesWon
        doubleKills tripleKills quadraKills pentaKills
        maxKills maxAssists maxDeaths
        maxGold maxHeroDamage maxHeroDamageTaken
        maxDuration maxObjectiveDamage maxStructureDamage
        maxMinionsKilled maxWardsPlaced maxWardsDestroyed
        maxKillingSpree maxLargestCritical
      }
      filter { gameModes roles versions }
    }
    
    ratings {
      id points ranking percentile
      rank { id name tierName divisionIdx tierIdx ratingMin ratingMax icon abbreviation }
      peakRank { name tierName }
      peakPoints peakRanking peakPercentile
    }
    
    favHero { name slug data { displayName } }
  }
}
```

### 4.3 Estadísticas por héroe

```graphql
query PlayerHeroStats($playerId: ID!) {
  player(by: { id: $playerId }) {
    heroStatistics(filter: {}) {
      results {
        hero { name slug data { displayName roles } }
        matchesPlayed matchesWon
        totalKills totalDeaths totalAssists
        totalHeroDamage totalHeroDamageTaken
        totalGold totalMinionsKilled
        totalWardsPlaced totalWardsDestroyed
        totalTime objectiveDamage structureDamage
        doubleKills tripleKills quadraKills pentaKills
        maxKills maxAssists maxDeaths maxGold maxHeroDamage
        maxHeroDamageTaken maxKillingSpree maxMinionsKilled
        maxObjectiveDamage maxStructureDamage maxWardsPlaced
        maxWardsDestroyed maxDoubleKills maxTripleKills
        maxQuadraKills maxPentaKills maxDuration maxLargestCritical
      }
    }
  }
}
```

### 4.4 Estadísticas por rol

```graphql
query PlayerRoleStats($playerId: ID!) {
  player(by: { id: $playerId }) {
    roleStatistics(filter: {}) {
      results {
        role
        matchesPlayed matchesWon
        totalKills totalDeaths totalAssists
        totalHeroDamage totalGold
        doubleKills pentaKills
      }
    }
  }
}
```

### 4.5 Estadísticas por modo de juego

```graphql
query PlayerGamemodeStats($playerId: ID!) {
  player(by: { id: $playerId }) {
    gamemodeStatistics(filter: {}) {
      results {
        gameMode
        matchesPlayed matchesWon
        totalKills totalDeaths totalAssists
        totalHeroDamage totalGold
      }
    }
  }
}
```

### 4.6 Progresión temporal (intervalos)

```graphql
query PlayerProgression($playerId: ID!) {
  player(by: { id: $playerId }) {
    # interval: DAY | WEEK | MONTH | QUARTER | YEAR
    intervalStatistics(filter: {}, interval: MONTH) {
      results {
        intervalStart   # Fecha inicio del intervalo
        matchesPlayed
        matchesWon
        ratingData {
          maxPoints     # Puntos máximos en el intervalo
          rating { id name }
        }
      }
    }
  }
}
```

### 4.7 Compañeros habituales

```graphql
query CommonPlayers($playerId: ID!) {
  player(by: { id: $playerId }) {
    commonPlayers(limit: 10, isAlly: true, filter: {}) {
      # CommonPlayerResult → CommonPlayer
    }
    
    # Jugadores frecuentes como rival
    enemyCommonPlayers: commonPlayers(limit: 10, isAlly: false, filter: {}) {
      # ...
    }
  }
}
```

### 4.8 Historial de partidas del jugador y obtención del MatchId

> **Importante:** Para acceder al historial de un jugador, primero se necesita su UUID interno. `PlayerKey` NO acepta nombre/slug — sólo `id`, `uuid` o `legacyUuid`. El flujo es siempre: **buscar por nombre → obtener UUID → consultar historial**.

#### Paso 1: Resolver UUID del jugador por nombre

```graphql
query FindPlayerUUID($name: String!) {
  playersPaginated(
    filter: { search: $name }   # "search" es el único campo de PlayerFilterInput y es obligatorio
    limit: 5
    offset: 0
  ) {
    results {
      id       # Mismo valor que uuid en este tipo
      uuid     # UUID interno del jugador: "4cce16d0-5101-499f-9136-3c122895fd0f"
      name
      favRole
    }
  }
}
```

#### Paso 2: Obtener historial de partidas con el UUID

```graphql
query PlayerMatches($playerUUID: UUID!, $limit: Int, $offset: Int) {
  player(by: { uuid: $playerUUID }) {
    matchesPaginated(
      limit: $limit    # Max recomendado: 20-50
      offset: $offset
      filter: {
        gameModes: [RANKED, STANDARD]
        # heroes: ["grux", "dekker"]  # Filtrar por slug de héroe
        # roles: [JUNGLE]             # Filtrar por rol
      }
    ) {
      results {
        # MatchPlayer.id → ID numérico del registro del jugador en esa partida
        id

        # Datos de rendimiento del jugador
        role team
        kills deaths assists gold heroDamage
        hero { id slug }

        # Rating resultante (si fue partida ranked)
        rating { points isRankup rank { name } }

        # Referencia a la partida completa
        match {
          id          # ← ESTE es el MatchId (UUID): "7001da89-571a-4c6d-b958-29c274f3126e"
          startTime endTime duration
          gameMode region winningTeam
          version { id name releaseDate }
        }
      }
    }
  }
}
```

#### Lookup directo de una partida por MatchId

Una vez obtenido el `match.id` (UUID), se puede consultar la partida completa con todos los jugadores:

```graphql
query MatchDetail($matchId: ID!) {
  match(by: { id: $matchId }) {   # matchId = UUID de la partida
    id startTime endTime duration
    gameMode region winningTeam
    version { id name releaseDate }

    matchPlayers {
      id role team
      kills deaths assists gold heroDamage
      hero { id slug }
      player { id name uuid }   # null si el jugador tiene privacidad activa
    }
  }
}
```

> **Nota:** `MatchPlayer.id` es el ID del registro del jugador en esa partida (numérico). `MatchPlayer.match.id` es el UUID de la partida en sí — el que se usa para hacer lookup con `match(by: { id: "..." })`. El resultado de la partida (victoria/derrota) se determina comparando `matchPlayer.team` con `match.winningTeam`.

---

## 5. Módulo 2: Análisis de Partidas

### 5.1 Tipo `Match` — campos completos

```
id, uuid
startTime, endTime, duration (segundos)
gameMode: GameMode
region: Region
winningTeam: MatchPlayerTeam (DAWN | DUSK)
version → Version
heroBans: [{ heroData { displayName }, team }]
matchPlayers: [MatchPlayer]
heroKills, objectiveKills, structureDestructions (agregados)
spoilerBlockedUntil: DateTime
```

### 5.2 Tipo `MatchPlayer` — TODOS los campos (datos de rendimiento en partida)

```
id, name
role: Role
team: MatchPlayerTeam (DAWN | DUSK)
player → Player (puede ser null si el jugador es privado/HIDDEN)

# KDA
kills, deaths, assists
multiKill        # Mayor multikill en la partida
largestKillingSpree

# Daño
heroDamage                        # Daño total a héroes
heroDamageTaken                   # Daño recibido de héroes
totalDamageDealt                  # Todo el daño infligido
totalDamageMitigated              # Daño mitigado/bloqueado
totalDamageTaken                  # Todo el daño recibido
totalDamageDealtToObjectives      # Daño a objetivos
totalDamageDealtToStructures      # Daño a estructuras
physicalDamageDealt               # Daño físico total
physicalDamageDealtToHeroes       # Daño físico a héroes
physicalDamageTaken               # Daño físico recibido
physicalDamageTakenFromHeroes
magicalDamageDealt
magicalDamageDealtToHeroes
magicalDamageTaken
magicalDamageTakenFromHeroes
largestCriticalStrike             # Mayor golpe crítico

# Curación
itemHealingDone     # Curación de ítems
crestHealingDone    # Curación de crests

# Economía
gold                # Oro total ganado
goldSpent
goldEarnedAtInterval  # Lista de oro por intervalos de tiempo → [{ gameTime, gold }]

# Granja
minionsKilled
laneMinionsKilled
neutralMinionsKilled
neutralMinionsTeamJungle      # Neutrales en jungla propia
neutralMinionsEnemyJungle     # Neutrales en jungla enemiga

# Visión
wardsPlaced
wardsDestroyed

# Progresión
level                # Nivel al final de la partida
endTime              # Cuándo terminó para este jugador

# Build y habilidades
heroData → HeroData          # Datos del héroe jugado
perkData → PerkData          # Crest equipado
inventoryItemData → [ItemData] # Ítems en inventario
abilityOrder → [AbilityData] # Orden de habilidades: [{ ability, gameTime }]

# Rating resultante
rating → MatchPlayerRating {
  points       # Puntos después de la partida
  isRankup     # ¿Subió de rango?
  newPoints    # Nuevos puntos
  rank { name tierName }
  rating → Rating
  ratingData   # Datos adicionales de rating
}
```

### 5.3 Query de partida completa

```graphql
query FullMatch($matchId: ID!) {
  match(by: { id: $matchId }) {
    id uuid startTime endTime duration
    gameMode region winningTeam
    version { id gameString releaseDate patchType }
    
    heroBans {
      heroData { displayName }
      team
    }
    
    matchPlayers {
      name role team
      player { id name uuid }
      
      kills deaths assists multiKill largestKillingSpree
      gold goldSpent
      heroDamage heroDamageTaken
      totalDamageDealt totalDamageMitigated
      totalDamageDealtToObjectives totalDamageDealtToStructures
      physicalDamageDealtToHeroes magicalDamageDealtToHeroes
      itemHealingDone crestHealingDone
      
      minionsKilled neutralMinionsKilled
      neutralMinionsTeamJungle neutralMinionsEnemyJungle
      wardsPlaced wardsDestroyed
      level
      largestCriticalStrike
      
      goldEarnedAtInterval  # Gold over time
      abilityOrder { ability gameTime }
      
      heroData { displayName }
      perkData { displayName slot }
      inventoryItemData { displayName price totalPrice }
      
      rating {
        points isRankup newPoints
        rank { name tierName }
      }
    }
  }
}
```

### 5.4 Métricas derivadas calculables

Con los datos de `MatchPlayer` se pueden calcular en el frontend:

```
KDA = (kills + assists) / max(deaths, 1)
CSM = (minionsKilled + neutralMinionsKilled) / (duration / 60)
GPM = gold / (duration / 60)
DPM_hero = heroDamage / (duration / 60)
DPM_total = totalDamageDealt / (duration / 60)
Kill Participation = (kills + assists) / teamTotalKills * 100
Damage Share = heroDamage / teamTotalDamage * 100
Heal/Support Score = (itemHealingDone + crestHealingDone)
Vision Score = (wardsPlaced + wardsDestroyed)
Jungle Invasion Rate = neutralMinionsEnemyJungle / (neutralMinionsEnemyJungle + neutralMinionsTeamJungle)
```

---

## 6. Módulo 3: Scouting de Jugadores

### 6.1 Búsqueda por nombre

```graphql
query SearchPlayer($name: String!) {
  playersPaginated(
    filter: { search: $name }
    limit: 20
    offset: 0
  ) {
    totalCount
    results {
      id name uuid favRole firstPlayedAt lastPlayedAt
      favHero { name data { displayName } }
      ratings { points ranking percentile rank { name tierName } }
    }
  }
}
```

### 6.2 Scouting por leaderboard (top jugadores por temporada)

```graphql
query LeaderboardScouting($ratingId: ID!, $limit: Int, $offset: Int) {
  leaderboardPaginated(
    ratingId: $ratingId    # "11" = S1S4 (actual), "10" = S1S3, etc.
    limit: $limit
    offset: $offset
  ) {
    totalCount
    results {
      rank { name tierName divisionIdx }
      points ranking percentile
      player {
        id name uuid favRole
        favHero { name data { displayName } }
        heroStatistics(filter: {}) {
          results {
            hero { name data { displayName } }
            matchesPlayed matchesWon
          }
        }
        roleStatistics(filter: {}) {
          results { role matchesPlayed matchesWon }
        }
      }
    }
  }
}
```

**IDs de temporadas disponibles:**
```
"3"  → Season 0      (finalizada: 2025-04-28)
"4"  → S1 Split 1    (finalizada: 2025-09-02)
"5"  → S1 Split 2    (finalizada: 2025-11-25)
"10" → S1 Split 3    (finalizada: 2026-02-24)
"11" → S1 Split 4    (activa)
```

### 6.3 Perfil completo para scouting

```graphql
query ScoutPlayer($playerId: ID!) {
  player(by: { id: $playerId }) {
    id name uuid
    favRole favHero { name data { displayName } }
    firstPlayedAt lastPlayedAt
    
    # Ranking actual
    ratings {
      points ranking percentile
      rank { name tierName divisionIdx }
      peakRank { name tierName }
      peakPoints peakRanking
    }
    
    # Héroes más jugados
    heroStatistics(filter: {}) {
      results {
        hero { name slug data { displayName roles } }
        matchesPlayed matchesWon
        totalKills totalDeaths totalAssists
        totalHeroDamage pentaKills
      }
    }
    
    # Rendimiento por rol
    roleStatistics(filter: {}) {
      results {
        role matchesPlayed matchesWon
        totalKills totalDeaths totalAssists totalHeroDamage
      }
    }
    
    # Progresión mensual (tendencia)
    intervalStatistics(filter: {}, interval: MONTH) {
      results { intervalStart matchesPlayed matchesWon }
    }
    
    # Últimas 20 partidas
    matchesPaginated(limit: 20) {
      results {
        match { id gameMode duration region winningTeam version { gameString } }
        role hero { name data { displayName } }
        kills deaths assists gold heroDamage
      }
    }
  }
}
```

### 6.4 Filtrado por región

La región se obtiene de las partidas individuales (`match.region`). Para scouting regional:

```graphql
# Estrategia: obtener partidas recientes y filtrar por region
# No hay filtro directo de región en leaderboard/playersPaginated
# Alternativa: usar matchesPaginated con filter de gameMode y comprobar match.region

query PlayerRegionCheck($playerId: ID!) {
  player(by: { id: $playerId }) {
    matchesPaginated(limit: 10, filter: { gameModes: [RANKED] }) {
      results {
        match { region }
      }
    }
  }
}
```

> **Nota arquitectónica:** Para scouting regional eficiente, se recomienda cachear los perfiles del leaderboard e indexar por región inferida de sus últimas partidas.

### 6.5 Score de scouting calculable

Con los datos disponibles, la app puede calcular un **Scouting Score** por rol:

```javascript
function scoutScore(player, role) {
  const roleStat = player.roleStatistics.results.find(r => r.role === role);
  const currentRating = player.ratings[0];
  
  return {
    winRate: roleStat.matchesWon / roleStat.matchesPlayed,
    kda: (roleStat.totalKills + roleStat.totalAssists) / Math.max(roleStat.totalDeaths, 1),
    ranking: currentRating.ranking,
    percentile: currentRating.percentile,
    experience: roleStat.matchesPlayed,
    peak: currentRating.peakRank?.name,
    trend: calculateTrend(player.intervalStatistics.results) // últimos 3 meses
  };
}
```

---

## 7. Módulo 4: Equipos

### 7.1 Tipo `Team`

```
id: ID
name: String
abbreviation: String
image → UploadedFile
teamPlayers → [TeamPlayer]
eventEntries → [EventEntry]   # Participaciones en torneos
```

### 7.2 Tipo `TeamPlayer`

```
id: ID
player → Player
team → Team
```

### 7.3 Listar todos los equipos

```graphql
query AllTeams {
  teams {
    id name abbreviation
    teamPlayers {
      id
      player {
        id name uuid favRole
        ratings { points rank { name } ranking }
      }
    }
  }
}
```

### 7.4 Equipo específico con jugadores y stats

```graphql
query TeamDetail($teamId: ID!) {
  team(id: $teamId) {
    id name abbreviation
    teamPlayers {
      player {
        id name uuid favRole
        favHero { name data { displayName } }
        ratings { points rank { name tierName } ranking percentile }
        heroStatistics(filter: {}) {
          results {
            hero { name data { displayName } }
            matchesPlayed matchesWon totalKills totalDeaths totalAssists
          }
        }
        roleStatistics(filter: {}) {
          results { role matchesPlayed matchesWon }
        }
        generalStatistic(filter: {}) {
          result { matchesPlayed matchesWon pentaKills }
        }
      }
    }
    eventEntries {
      # Participaciones en torneos/eventos
    }
  }
}
```

> **Nota:** Los equipos en pred.gg son principalmente para torneos de la comunidad. La mayoría tienen `teamPlayers` vacío. Los equipos "scrims" del usuario deberán gestionarse en la base de datos propia de la aplicación.

### 7.5 Gestión de equipo propio (Mutations)

```graphql
# Crear equipo
mutation CreateTeam {
  createTeam(input: {
    name: "Mi Equipo"
    abbreviation: "ME"
  }) { id name }
}

# Actualizar equipo
mutation UpdateTeam($id: ID!) {
  updateTeam(id: $id, input: { name: "Nuevo Nombre" }) { id name }
}
```

---

## 8. Módulo 5: Héroes y Estadísticas por Parche

### 8.1 Tipo `Hero` — campos completos

```
id, name, slug
data(version: ID) → HeroData  # version opcional para datos históricos
generalStatistic(filter: HeroGeneralStatisticFilterInput) → HeroGeneralStatisticResult
heroStatistics → ...
leaderboard(filter, timeframe, scope, sortBy) → HeroLeaderboardResult
matchesPaginated(filter, limit, offset) → PaginatedHeroMatches
matchupStatistic(filter, metric, order, isAlly, sameRole) → HeroMatchupStatisticResult
coreBuild(filter, heroPerk, limit) → HeroCoreBuildResult
simpleBuild(filter, heroPerk) → HeroSimpleBuildResult
availableVersions → [Version]
```

### 8.2 Tipo `HeroData`

```
displayName: String
roles: [Role]
description: String
icon, promoIcon: String (URLs)
altDisplayName: String

abilities: [HeroAbility] {
  displayName, gameDescription, menuDescription, simplifiedDescription
  type: AbilityType
  cooldown: [Float]   # Por nivel
  cost: [Float]       # Por nivel
  icon: String
  video: String
}

mainAttributes: HeroMainAttributes {
  abilityPower, attackPower, durability, mobility  # 1-5 stars
}

attributes: [HeroAttribute] {
  stat: String       # e.g. "PHYSICAL_POWER", "MAX_HEALTH", etc.
  values: [Float]    # Valor por nivel 1-18
}

defaultSkin → HeroSkin { displayName, icon, portrait, smallPortrait }
classes: [String]
perks: [PerkData]  # Crests recomendados
recommendedBuild(gameMode: GameMode!, role: Role!) → HeroRecommendedBuild {
  crestData → PerkData
  crestEvolutionData → PerkData
  itemData → [ItemData]
  role, gameMode
}
recommendedBuilds: [HeroRecommendedBuild]
recommendedSkills: [String]
version → Version
```

### 8.3 Estadísticas globales de héroes

```graphql
query HeroGlobalStats($filter: HeroGeneralStatisticFilterInput) {
  heroes {
    id name slug
    data { displayName roles }
    generalStatistic(filter: $filter) {
      result {
        matchesPlayed matchesWon matchesBanned
        matchesPlayedMirrorless matchesWonMirrorless
        totalKills totalDeaths totalAssists
        totalSecondsPlayed
        gold heroDamage heroDamageTaken
        objectiveDamage structureDamage
        wardsPlaced wardsDestroyed
        # Métricas derivadas calculables:
        # winRate = matchesWon / matchesPlayed
        # pickRate = matchesPlayed / totalMatchesInPeriod
        # banRate = matchesBanned / totalMatchesInPeriod
        # KDA = (totalKills + totalAssists) / totalDeaths
      }
      filter { gameModes ranks roles versions }
    }
  }
}

# Para filtrar por parche específico:
# filter: { versions: ["143"] }  → Solo parche actual
# filter: { versions: ["141", "142", "143"] }  → Últimos 3 parches
# filter: { ranks: ["Paragon", "Radiant", "Diamond"] }  → Solo jugadores altos
# filter: { gameModes: [RANKED] }  → Solo ranked
```

### 8.4 Comparativa entre parches (Hero diff)

```graphql
# Query separada por cada parche a comparar
query HeroDiff($heroSlug: String!, $patchIdA: ID!, $patchIdB: ID!) {
  hero(by: { slug: $heroSlug }) {
    slug
    dataA: data(version: $patchIdA) {
      displayName
      attributes { stat values }
      abilities { displayName cooldown cost }
    }
    dataB: data(version: $patchIdB) {
      displayName
      attributes { stat values }
      abilities { displayName cooldown cost }
    }
    statsA: generalStatistic(filter: { versions: [$patchIdA] }) {
      result { matchesPlayed matchesWon matchesBanned totalKills totalDeaths }
    }
    statsB: generalStatistic(filter: { versions: [$patchIdB] }) {
      result { matchesPlayed matchesWon matchesBanned totalKills totalDeaths }
    }
  }
}
```

### 8.5 Lista de versiones/parches y selector multi-versión

> **Confirmado por prueba directa:** `versions` devuelve los 144 parches sin paginación ni argumentos. El selector de versiones funciona de forma nativa mediante el argumento `filter: { versions: [...] }` de `generalStatistic`.

```graphql
query AllVersions {
  versions {
    id               # ID numérico ("1" = 0.1, "144" = última)
    name             # Nombre legible: "1.13.1+1"
    changelist
    gameString       # e.g. "5.4.4-626017+//Predecessor/Release-1.13"
    releaseDate      # ISO 8601
    patchNotesUrl    # URL a notas del parche (puede ser null en hotfixes)
    patchType        # CONTENT | BALANCE | HOTFIX
    steamBuild
    steamManifest
    # heroData, itemData, perkData → datos de cada entidad en esa versión
  }
}
```

#### Selector de N versiones para un héroe (comparativa multi-parche)

La UI puede mostrar un selector con los 144 parches. Al elegir varios, se hace una query con aliases para obtener los stats de cada uno en una sola petición:

```graphql
# Ejemplo: comparar Twinblast en los últimos 4 parches
query HeroVersionSelector {
  hero(by: { slug: "twinblast" }) {
    name
    availableVersions { id name releaseDate }   # Versiones en que existe este héroe

    v141: generalStatistic(filter: { versions: ["141"] }) {
      result { matchesPlayed matchesWon matchesBanned totalKills totalDeaths totalAssists heroDamage gold totalSecondsPlayed }
    }
    v142: generalStatistic(filter: { versions: ["142"] }) {
      result { matchesPlayed matchesWon matchesBanned totalKills totalDeaths totalAssists heroDamage gold totalSecondsPlayed }
    }
    v143: generalStatistic(filter: { versions: ["143"] }) {
      result { matchesPlayed matchesWon matchesBanned totalKills totalDeaths totalAssists heroDamage gold totalSecondsPlayed }
    }
    v144: generalStatistic(filter: { versions: ["144"] }) {
      result { matchesPlayed matchesWon matchesBanned totalKills totalDeaths totalAssists heroDamage gold totalSecondsPlayed }
    }
  }
}
```

**Resultado real de esta query (Twinblast, parches 1.13 → 1.13.2):**
```
v141 (1.13):      3.650 partidas | 49.75% WR | 30 bans
v142 (1.13.1):   21.865 partidas | 50.26% WR | 370 bans
v143 (1.13.1+1): 37.149 partidas | 49.00% WR | 710 bans
v144 (1.13.2):      111 partidas | 49.55% WR | 0 bans  ← parche reciente, pocos datos aún
```

> **Métricas calculadas en frontend** (no vienen directas de la API):
> - `winRate = matchesWon / matchesPlayed`
> - `banRate = matchesBanned / totalMatchesInVersion` (totalMatches necesita sumarse de todos los héroes)
> - `pickRate = matchesPlayed / totalMatchesInVersion`
> - `KDA_avg = totalKills / totalDeaths`
> - `GPM_avg = gold / totalSecondsPlayed * 60`
> - `DPM_avg = heroDamage / totalSecondsPlayed * 60`

También se puede filtrar los stats de versión por rango o modo de juego simultáneamente:
```graphql
# Stats de héroe en ranked Diamond+ para el parche actual
hero(by: { slug: "twinblast" }) {
  generalStatistic(filter: {
    versions: ["144"]
    gameModes: [RANKED]
    ranks: ["Diamond", "Paragon", "Radiant"]
  }) {
    result { matchesPlayed matchesWon matchesBanned }
  }
}
```

**Parsear versión del gameString:**
```javascript
function parseVersion(gameString) {
  // "5.4.4-626017+//Predecessor/Release-1.13"
  const match = gameString?.match(/Release-(\d+\.\d+)/);
  return match ? match[1] : gameString;
}
```

### 8.6 Leaderboard por héroe

```graphql
query HeroLeaderboard($heroSlug: String!) {
  hero(by: { slug: $heroSlug }) {
    leaderboard(
      timeframe: ALL_TIME        # ALL_TIME | LAST_30_DAYS
      scope: DIAMOND_OR_HIGHER  # NONE | DIAMOND_OR_HIGHER
      sortBy: WINRATE           # WINRATE | MATCHES_PLAYED
    ) {
      results {
        player { id name uuid favRole }
        winRate
        matches
      }
    }
  }
}
```

---

## 9. Módulo 6: Ítems y Crests por Parche

### 9.1 Tipo `ItemData` — campos completos

```
id, name, displayName
rarity:        COMMON | UNCOMMON | RARE | EPIC | LEGENDARY
slotType:      ACTIVE | PASSIVE
aggressionType: OFFENSE | DEFENSE | UTILITY
class:         NONE | ...
price:         Int    # Coste de la receta (sin componentes)
totalPrice:    Int    # Coste total (incluyendo componentes)
isEvolved:     Boolean
isHidden:      Boolean
icon, smallIcon: String (URLs)
effects:       String (descripción de efectos activos)
gameId:        String

stats: [ItemStat] {
  stat:        String   # e.g. "PHYSICAL_POWER", "MAX_HEALTH", "COOLDOWN_REDUCTION"
  value:       Float
  showPercent: Boolean
}

buildsFrom: [Item]     # Componentes necesarios
buildsInto: [Item]     # Ítems que usa este como componente
blockedBy:  [Item]     # Ítems que lo bloquean
blocks:     [Item]     # Ítems que este bloquea

version → Version      # Versión en que se introdujo/modificó
item → Item            # Referencia al Item base
```

### 9.2 Query de ítems con árbol de build

```graphql
query AllItems {
  items {
    id name slug
    data {
      displayName rarity slotType aggressionType class
      price totalPrice isEvolved isHidden
      stats { stat value showPercent }
      buildsFrom { id name data { displayName price } }
      buildsInto { id name data { displayName totalPrice } }
      blockedBy { id name data { displayName } }
      effects
    }
  }
}
```

### 9.3 Ítem por parche específico (diff)

```graphql
query ItemDiff($itemId: ID!, $versionId: ID!) {
  item(by: { id: $itemId }) {
    id name slug
    # Los datos del ítem incluyen la versión en que fue actualizado
    data {
      displayName
      stats { stat value }
      price totalPrice
      version { id gameString releaseDate }
    }
  }
}
```

> **Nota:** La API no tiene un endpoint directo "dame el ítem en versión X vs versión Y". La estrategia es cachear todos los ítems con cada versión y comparar localmente.

### 9.4 Tipo `PerkData` (Crests)

```
id, name, displayName
slot:            String   # Posición del crest
aggressionTypes: [String]
simpleDescription: String
description:     String
icon:            String (URL)
displayOrder:    Int

hero → Hero           # Si es crest específico de héroe
heroData → HeroData   # Datos del héroe asociado
version → Version
perk → Perk
```

### 9.5 Todos los crests

```graphql
query AllPerks {
  perks {
    id name slug
    data {
      displayName simpleDescription description
      slot aggressionTypes displayOrder
      icon
    }
  }
}
```

---

## 10. Módulo 7: Build Calculator

### 10.1 Datos necesarios para el calculador

El Build Calculator necesita estos datos de la API:

**Héroes con atributos base y escalado:**
```graphql
query HeroBuildData($heroSlug: String!) {
  hero(by: { slug: $heroSlug }) {
    id name slug
    data {
      displayName roles
      
      # Stats base nivel 1-18
      attributes {
        stat     # Nombre del stat (PHYSICAL_POWER, MAX_HEALTH, etc.)
        values   # Array de 18 valores (uno por nivel)
      }
      
      # Puntuaciones de categoría (1-5)
      mainAttributes {
        abilityPower attackPower durability mobility
      }
      
      # Habilidades con cooldown y coste por nivel
      abilities {
        displayName type
        cooldown  # Array por nivel de habilidad
        cost      # Array por nivel
      }
      
      # Build recomendada oficial
      recommendedBuild(gameMode: STANDARD, role: SUPPORT) {
        crestData { displayName stats { stat value } }
        crestEvolutionData { displayName }
        itemData { displayName price totalPrice stats { stat value } }
      }
    }
    
    # Build comunitaria más usada
    coreBuild(limit: 5) {
      abilities      # Orden de habilidades
      core1Item { id name data { displayName stats { stat value } } }
      core2Item { id name data { displayName stats { stat value } } }
      core3Item { id name data { displayName stats { stat value } } }
      items { id name data { displayName stats { stat value } } }
      perks { id name data { displayName } }
      matchesPlayedAnyOrder
      matchesWonAnyOrder
      matchesPlayedBuildOrder
      matchesWonBuildOrder
    }
  }
}
```

**Todos los ítems con stats:**
```graphql
query BuildItems {
  items {
    id name slug
    data {
      displayName rarity slotType aggressionType class
      price totalPrice isEvolved
      stats { stat value showPercent }
      buildsFrom { id name data { displayName price stats { stat value } } }
      buildsInto { id name }
      blockedBy { id name }
      blocks { id name }
      effects
    }
  }
}
```

### 10.2 Lógica del Build Calculator (frontend)

```javascript
// Stats de un héroe con build completa
function calculateBuildStats(hero, items, perk, level = 18) {
  // Stats base del héroe al nivel elegido
  const baseStats = {};
  hero.data.attributes.forEach(attr => {
    baseStats[attr.stat] = attr.values[level - 1]; // índice 0 = nivel 1
  });
  
  // Sumar stats de ítems
  const itemStats = {};
  items.forEach(item => {
    item.data.stats.forEach(s => {
      itemStats[s.stat] = (itemStats[s.stat] || 0) + s.value;
    });
  });
  
  // Stats del crest
  const perkStats = {};
  if (perk) {
    perk.data.stats?.forEach(s => {
      perkStats[s.stat] = (perkStats[s.stat] || 0) + s.value;
    });
  }
  
  // Combinar con reglas de Predecessor:
  // - Algunos stats son aditivos, otros multiplicativos
  // - Aplicar caps de stats si existen
  return combineStats(baseStats, itemStats, perkStats);
}

// Coste total del build
function buildCost(items) {
  return items.reduce((sum, item) => sum + item.data.price, 0);
  // Nota: usar price (solo receta) o totalPrice según contexto
}

// Comprobar conflictos (blockedBy/blocks)
function checkConflicts(items) {
  const conflicts = [];
  items.forEach(item => {
    item.data.blockedBy.forEach(blocked => {
      if (items.find(i => i.id === blocked.id)) {
        conflicts.push({ item: item.data.displayName, blockedBy: blocked.data.displayName });
      }
    });
  });
  return conflicts;
}
```

### 10.3 Stats disponibles en ítems (valores de `ItemStat.stat`)

Basado en el análisis, los stats comunes incluyen:
```
PHYSICAL_POWER, MAGICAL_POWER
MAX_HEALTH, HEALTH_REGEN
MAX_MANA, MANA_REGEN
ATTACK_SPEED, MOVEMENT_SPEED
PHYSICAL_ARMOR, MAGICAL_ARMOR
COOLDOWN_REDUCTION
CRITICAL_CHANCE, CRITICAL_DAMAGE
LIFESTEAL, MAGICAL_LIFESTEAL
TENACITY, CROWD_CONTROL_REDUCTION
```

---

## 11. Módulo 8: Análisis de Rivales

### 11.1 Matchups de héroe (contra quién gana/pierde)

```graphql
query HeroMatchups($heroSlug: String!, $role: Role) {
  hero(by: { slug: $heroSlug }) {
    # Matchups como ENEMIGO
    enemyMatchups: matchupStatistic(
      filter: { roles: [$role] }  # Opcional: filtrar por rol
      isAlly: false
      metric: WINRATE
      order: DESC
    ) {
      results {
        matchupHero { name slug data { displayName roles } }
        winrate      # Winrate de nuestro héroe CONTRA este
        loserate
        matchesPlayed
        firstTowerTime     # Tiempo promedio primer torre
        firstTowerTimeDiff # Diferencia vs promedio
      }
    }
    
    # Synergias como ALIADO
    allyMatchups: matchupStatistic(
      filter: {}
      isAlly: true
    ) {
      results {
        matchupHero { name slug data { displayName roles } }
        winrate matchesPlayed
      }
    }
  }
}
```

### 11.2 Análisis de un jugador rival específico

```graphql
query RivalAnalysis($playerId: ID!) {
  player(by: { id: $playerId }) {
    id name uuid favRole
    
    # Héroes que más juega
    heroStatistics(filter: {}) {
      results {
        hero { name slug data { displayName roles } }
        matchesPlayed matchesWon totalKills totalDeaths totalAssists
        totalHeroDamage
      }
    }
    
    # Rendimiento por rol
    roleStatistics(filter: {}) {
      results { role matchesPlayed matchesWon totalKills totalDeaths totalAssists }
    }
    
    # Rendimiento reciente (último mes)
    recentStats: intervalStatistics(filter: {}, interval: MONTH) {
      results { intervalStart matchesPlayed matchesWon }
    }
    
    # Últimas 10 partidas ranked
    matchesPaginated(limit: 10, filter: { gameModes: [RANKED] }) {
      results {
        match { region gameMode duration winningTeam version { gameString } }
        role hero { name data { displayName } }
        kills deaths assists gold heroDamage wardsPlaced wardsDestroyed
      }
    }
    
    # Rating actual
    ratings { points rank { name tierName } ranking percentile }
  }
}
```

### 11.3 Draft counter-picking

```javascript
// Con los datos de matchupStatistic se puede construir un sistema de counter-pick
async function getCounters(heroSlug, role) {
  const data = await gql(`
    query {
      hero(by: { slug: "${heroSlug}" }) {
        enemyMatchups: matchupStatistic(filter: {}, isAlly: false) {
          results {
            matchupHero { slug data { displayName roles } }
            winrate loserate matchesPlayed
          }
        }
      }
    }
  `);
  
  return data.hero.enemyMatchups.results
    .filter(m => m.matchesPlayed > 100) // Solo matchups con muestra significativa
    .sort((a, b) => a.winrate - b.winrate) // Los que más nos counternean primero
    .slice(0, 5);
}
```

---

## 12. Arquitectura Recomendada

### 12.1 Stack tecnológico sugerido

```
Frontend:   Next.js 14+ (App Router) + TypeScript
UI:         Tailwind CSS + shadcn/ui
Gráficas:   Recharts o Chart.js
Backend:    Next.js API Routes (proxy de GraphQL)
Cache:      Redis (datos estáticos) + React Query (datos dinámicos)
BD propia:  PostgreSQL (equipos, scrims, notas)
Auth:       NextAuth.js con OAuth de pred.gg
```

### 12.2 Estrategia de caché

```
DATOS ESTÁTICOS (actualizar cada parche ~2 semanas):
├── heroes (lista + data + abilities + attributes)
├── items (lista + stats + árbol de build)
├── perks/crests (lista completa)
└── versions (lista de parches)

DATOS SEMI-ESTÁTICOS (actualizar cada hora):
├── leaderboard (top 1000 jugadores)
├── heroStats globales (winrate/pickrate)
└── heroMatchups

DATOS DINÁMICOS (sin caché o caché corta 5min):
├── playersPaginated (búsqueda)
├── player profile (perfil individual)
├── match (partida específica)
└── currentUser
```

### 12.3 Estructura de la aplicación

```
/app
  /auth          → Login OAuth con pred.gg
  /dashboard     → Vista general del equipo
  /team
    /[id]        → Gestión del equipo
    /roster      → Plantilla y stats de miembros
    /scrims      → Registro de scrims (BD propia)
  /players
    /[id]        → Perfil detallado de jugador
    /compare     → Comparación entre jugadores
  /scouting      → Búsqueda y filtrado de jugadores
  /matches
    /[id]        → Análisis de partida
  /heroes
    /[slug]      → Stats del héroe por parche
    /compare     → Comparación de héroes
  /items
    /[slug]      → Ítem y árbol de build
  /meta          → Tier list y tendencias del parche
  /builds        → Build calculator
  /rivals        → Análisis de equipos rivales
  /draft         → Herramienta de draft con counters
```

### 12.4 Schema de BD propia (PostgreSQL)

```sql
-- Equipo propio
CREATE TABLE teams (
  id UUID PRIMARY KEY,
  name VARCHAR(100),
  tag VARCHAR(10),
  region VARCHAR(50),
  created_at TIMESTAMP
);

-- Roster del equipo (vinculado a players de pred.gg)
CREATE TABLE roster (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES teams(id),
  player_uuid UUID NOT NULL,       -- UUID de pred.gg
  player_name VARCHAR(100),
  role VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMP
);

-- Scrims registradas
CREATE TABLE scrims (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES teams(id),
  opponent_name VARCHAR(100),
  opponent_team_id UUID,           -- Si es equipo de pred.gg
  match_uuid UUID,                 -- UUID de pred.gg si está registrado
  date TIMESTAMP,
  result VARCHAR(10),              -- WIN | LOSS | DRAW
  game_mode VARCHAR(20),
  notes TEXT,
  vod_url VARCHAR(500)
);

-- Notas de scouting
CREATE TABLE scouting_notes (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES teams(id),
  player_uuid UUID NOT NULL,
  note TEXT,
  tags VARCHAR[],
  created_by VARCHAR(100),
  created_at TIMESTAMP
);

-- Builds guardadas
CREATE TABLE saved_builds (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES teams(id),
  hero_slug VARCHAR(50),
  name VARCHAR(100),
  items JSONB,                     -- Array de item IDs
  perk_id VARCHAR(50),
  game_mode VARCHAR(20),
  role VARCHAR(20),
  notes TEXT,
  created_by VARCHAR(100),
  created_at TIMESTAMP
);
```

---

## 13. Consideraciones Técnicas

### 13.1 Limitaciones conocidas de la API

1. **Jugadores privados:** `player.name` puede devolver `"HIDDEN"` si el jugador tiene activado `blockSearch`. El campo `player` en `MatchPlayer` puede ser `null`.

2. **Región no filtrable directamente:** No existe filtro por región en `playersPaginated` ni en `leaderboardPaginated`. La región se infiere de las partidas del jugador.

3. **Equipos con poco uso:** La mayoría de los 320 equipos registrados tienen `teamPlayers` vacío. Los equipos tienen uso principalmente en eventos oficiales.

4. **Items históricos:** No hay endpoint "dame el ítem X en el parche Y". Se debe cachear todos los datos por versión.

5. **Datos de partidas privadas:** Algunas partidas tienen todos los jugadores como "HIDDEN" por configuración de privacidad.

6. **Token expiración:** El `oauth_access_token` expira (ver `oauth_token_expires_at`). Implementar refresh automático con `oauth_refresh_token`.

7. **Sin filtro por país/nacionalidad:** El campo `country` está en el tipo `User`, no directamente en `Player`. Para obtenerlo: `player { user { country } }`. La búsqueda por nacionalidad requiere procesamiento local.

### 13.2 Obtención de país del jugador

```graphql
query PlayerCountry($playerId: ID!) {
  player(by: { id: $playerId }) {
    id name
    user {
      country        # Código ISO del país (ej: "ES", "US")
      countryPublic  # Boolean: si el jugador hace público su país
    }
  }
}
```

### 13.3 Manejo de errores GraphQL

```javascript
// La API devuelve errores parciales (datos + errores simultáneos)
async function gqlSafe(query, variables = {}) {
  const res = await fetch('https://pred.gg/gql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ query, variables })
  });
  
  const json = await res.json();
  
  // GraphQL puede devolver data parcial incluso con errores
  if (json.errors) {
    const forbidden = json.errors.filter(e => e.message === 'Forbidden');
    if (forbidden.length > 0) {
      // Token expirado o sin permisos
      await refreshToken();
      return gqlSafe(query, variables); // Reintentar
    }
    console.warn('GraphQL warnings:', json.errors);
  }
  
  return json.data;
}
```

### 13.4 Paginación

```javascript
// Patrón de paginación para leaderboard/players
async function fetchAllLeaderboard(ratingId, pageSize = 100) {
  let offset = 0;
  let results = [];
  let totalCount = Infinity;
  
  while (offset < totalCount) {
    const data = await gql(`
      query {
        leaderboardPaginated(ratingId: "${ratingId}", limit: ${pageSize}, offset: ${offset}) {
          totalCount
          results { rank { name } points ranking player { id name uuid } }
        }
      }
    `);
    
    totalCount = data.leaderboardPaginated.totalCount;
    results = results.concat(data.leaderboardPaginated.results);
    offset += pageSize;
  }
  
  return { totalCount, results };
}
```

### 13.5 Rate Limiting — hallazgos reales

**Resultado de las pruebas:**

| Test | Resultado |
|------|-----------|
| 10 requests secuenciales | 200 OK, ~38ms cada uno |
| 50 requests completamente concurrentes | 200 OK todos, sin throttling |
| Headers de rate-limit en respuestas | Ninguno (`X-RateLimit-*`, `Retry-After`, etc. ausentes) |

**Conclusión:** La API no tiene rate limiting documentado ni headers de throttling. Es una API interna sin política pública de uso.

**Recomendaciones para la aplicación:**

```javascript
// Implementar rate limiting propio por cortesía con el servidor
import pLimit from 'p-limit';

const limit = pLimit(10); // Máximo 10 requests concurrentes
const DELAY_MS = 100;     // 100ms entre peticiones en batches

async function gqlRateLimited(query, variables = {}) {
  return limit(async () => {
    const result = await gql(query, variables);
    await new Promise(r => setTimeout(r, DELAY_MS));
    return result;
  });
}

// Para cargas masivas (ej: obtener stats de 100 jugadores)
async function batchPlayerStats(playerIds) {
  return Promise.all(
    playerIds.map(id => gqlRateLimited(`
      query { player(by: { uuid: "${id}" }) { 
        generalStatistic(filter: {}) { result { matchesPlayed matchesWon } }
      } }
    `))
  );
}
```

> **Riesgo:** Al no haber documentación de rate limiting, el servidor podría implementar uno silencioso o bloquear IPs en el futuro. Se recomienda monitorizar respuestas `429 Too Many Requests` y añadir backoff exponencial.

```javascript
async function gqlWithBackoff(query, variables = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch('https://pred.gg/gql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ query, variables })
    });
    if (res.status === 429) {
      const wait = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    return res.json();
  }
  throw new Error('Rate limit exceeded after retries');
}
```

---

### 13.6 Política de uso de la API y registro de aplicaciones

#### Estado actual de los Términos de Servicio

pred.gg tiene unos [Términos de Servicio](https://pred.gg/terms) genéricos que:
- **Prohíben explícitamente:** Republicar material de pred.gg, vender/licenciar contenido de pred.gg, crear iFrames sin permiso previo.
- **No mencionan:** Uso de la API, scraping automatizado, aplicaciones de terceros, limitaciones de uso comercial de datos de la API, ni ninguna política de desarrolladores.

La API es el backend interno de pred.gg (no una API pública oficial), accedida exactamente igual que la web.

#### ¿Se puede crear la aplicación libremente?

| Tipo de uso | Situación |
|-------------|-----------|
| **Uso personal / equipo propio** | Sin restricciones claras. La app consume la misma API que el navegador. |
| **Aplicación pública no comercial** | Zona gris: no hay prohibición explícita, pero tampoco permiso. Recomendado contactar a pred.gg. |
| **Aplicación comercial** | Requiere permiso explícito. El ToS prohíbe "vender contenido de pred.gg". |

#### Sistema de registro de aplicaciones OAuth (existente en el schema)

El schema de pred.gg **ya incluye un sistema de registro de aplicaciones OAuth** que es exactamente lo que usaría una app de terceros para autenticarse de forma oficial:

```graphql
# Registrar una aplicación OAuth (requiere cuenta en pred.gg)
mutation CreateApplication {
  createApplication(input: {
    name: "Mi App de Análisis"
    # redirectUri: "https://mi-app.com/callback"
    # scopes: [...]
  }) {
    id
    clientId      # Client ID para el flujo OAuth
    clientSecret  # Secret para el backend
  }
}

# Consultar tu aplicación registrada
query MyApplication($id: ID!) {
  application(id: $id) {
    id name clientId
    # scopes, redirectUris, etc.
  }
}

# Flujo de autorización para usuarios de la app
mutation AuthorizeUser {
  authorize(
    clientId: "TU_CLIENT_ID"
    scope: "..."
    consent: true
  ) {
    # AuthorizeResult con código de autorización
  }
}
```

#### Recomendación práctica

1. **Para empezar (uso personal/equipo):** Usar el OAuth token propio del usuario logueado en pred.gg. No requiere registro de app. Funciona exactamente como la web.

2. **Para distribución a otros usuarios:** Registrar una aplicación con `createApplication` mutation. Esto da un `clientId` oficial para el flujo OAuth2 estándar — los usuarios autorizan la app con su cuenta de pred.gg.

3. **Para uso comercial:** Contactar al equipo de pred.gg. El canal más probable es su [Discord oficial de Predecessor](https://discord.gg/predecessor) donde pred.gg tiene presencia como herramienta de la comunidad.

4. **Créditos:** Cualquier aplicación debería incluir "Datos proporcionados por pred.gg" como buena práctica comunitaria.

> **Nota importante:** pred.gg y Omeda Studios (desarrolladora del juego Predecessor) son **entidades separadas**. pred.gg es un sitio de estadísticas de la comunidad, no el desarrollador oficial del juego. No es necesario contactar a Omeda Studios para usar la API de pred.gg.

---

### 13.7 Comparación de parches — algoritmo de diff

```javascript
// Detectar cambios entre dos versiones de un héroe
function heroVersionDiff(heroSlugDataA, heroSlugDataB) {
  const changes = [];
  
  // Comparar atributos base
  heroSlugDataA.attributes.forEach(attrA => {
    const attrB = heroSlugDataB.attributes.find(a => a.stat === attrA.stat);
    if (attrB) {
      const diffs = attrA.values.map((v, i) => ({ 
        level: i + 1, 
        old: v, 
        new: attrB.values[i], 
        delta: attrB.values[i] - v 
      })).filter(d => d.delta !== 0);
      
      if (diffs.length > 0) {
        changes.push({ type: 'STAT', stat: attrA.stat, diffs });
      }
    }
  });
  
  // Comparar cooldowns de habilidades
  heroSlugDataA.abilities.forEach(abilA => {
    const abilB = heroSlugDataB.abilities.find(a => a.displayName === abilA.displayName);
    if (abilB) {
      if (JSON.stringify(abilA.cooldown) !== JSON.stringify(abilB.cooldown)) {
        changes.push({ type: 'ABILITY_COOLDOWN', ability: abilA.displayName, old: abilA.cooldown, new: abilB.cooldown });
      }
      if (JSON.stringify(abilA.cost) !== JSON.stringify(abilB.cost)) {
        changes.push({ type: 'ABILITY_COST', ability: abilA.displayName, old: abilA.cost, new: abilB.cost });
      }
    }
  });
  
  return changes;
}

// Detectar cambios de ítem entre parches
function itemVersionDiff(itemDataA, itemDataB) {
  const changes = [];
  
  if (itemDataA.price !== itemDataB.price) {
    changes.push({ type: 'PRICE', old: itemDataA.price, new: itemDataB.price });
  }
  if (itemDataA.totalPrice !== itemDataB.totalPrice) {
    changes.push({ type: 'TOTAL_PRICE', old: itemDataA.totalPrice, new: itemDataB.totalPrice });
  }
  
  itemDataA.stats.forEach(statA => {
    const statB = itemDataB.stats.find(s => s.stat === statA.stat);
    if (!statB) {
      changes.push({ type: 'STAT_REMOVED', stat: statA.stat, value: statA.value });
    } else if (statA.value !== statB.value) {
      changes.push({ type: 'STAT_CHANGED', stat: statA.stat, old: statA.value, new: statB.value });
    }
  });
  
  return changes;
}
```

---

## Apéndice: Queries de referencia rápida

### Obtener todos los datos iniciales en una sola carga

```graphql
query AppBootstrap {
  # Datos estáticos (cachear agresivamente)
  heroes {
    id name slug
    data { displayName roles description icon
      abilities { displayName type cooldown cost }
      mainAttributes { abilityPower attackPower durability mobility }
    }
  }
  
  items {
    id name slug
    data { displayName rarity slotType aggressionType class
      price totalPrice isEvolved stats { stat value }
      buildsFrom { id name } buildsInto { id name }
    }
  }
  
  perks {
    id name slug
    data { displayName simpleDescription slot aggressionTypes icon }
  }
  
  ratings { id name group endTime }
  
  # versions no acepta argumentos — devuelve los 144 parches siempre
  # Filtrar los últimos 10 en el frontend: versions.slice(-10)
  versions {
    id name gameString releaseDate patchType patchNotesUrl
  }
}
```

### Búsqueda completa de jugador (scouting en una sola query)

```graphql
query ScoutFull($name: String!) {
  playersPaginated(filter: { search: $name }, limit: 5) {
    totalCount
    results {
      id name uuid favRole firstPlayedAt lastPlayedAt
      favHero { name data { displayName } }
      user { country countryPublic }
      ratings { points rank { name tierName } ranking percentile peakRank { name } }
      generalStatistic(filter: {}) {
        result { matchesPlayed matchesWon pentaKills maxKills }
      }
      heroStatistics(filter: {}) {
        results {
          hero { name data { displayName roles } }
          matchesPlayed matchesWon totalKills totalDeaths totalAssists
        }
      }
      roleStatistics(filter: {}) {
        results { role matchesPlayed matchesWon }
      }
    }
  }
}
```

---

*Documento generado mediante exploración directa de la API GraphQL de pred.gg · Versión explorada: parche 1.13.2 (id: 144) · Revisado: Abril 2026*  
*Actualizaciones v2: Rate limiting (probado 50 req concurrentes), selector multi-versión (confirmado), política de aplicaciones OAuth, flujo MatchId documentado.*
