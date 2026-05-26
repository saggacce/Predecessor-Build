# RiftLine — Platform Overview

**Empresa:** Synapsight  
**Tagline:** Competitive Intel  
**Producto:** Herramienta privada de inteligencia competitiva para el videojuego Predecessor (MOBA)

---

## Qué es RiftLine

RiftLine es una plataforma web de análisis competitivo diseñada para organizaciones y equipos profesionales o semi-profesionales de Predecessor. Agrega, procesa y visualiza datos de partidas para que coaches, analistas y managers tomen decisiones informadas antes, durante y después de la competición.

No es una herramienta pública de estadísticas — es un workspace privado por equipo, con roles diferenciados y datos propios sincronizados desde pred.gg.

---

## A quién va dirigido

| Rol | Uso principal |
|-----|---------------|
| **Manager** | Supervisión del equipo, gestión de roster, aprobación de informes |
| **Coach** | Análisis de partidas, gestión de Review Queue, generación de Battle Plans |
| **Analista** | Scouting de rivales, análisis de datos, insights automáticos |
| **Jugador** | Consulta de su perfil y objetivos personales |
| **Platform Admin** | Administración de usuarios, sincronización de datos, auditoría |

---

## Funcionalidades principales

### Player Scouting
Perfil completo de cualquier jugador sincronizado desde pred.gg:
- Estadísticas generales (KDA, WR, daño, CS, wards)
- Hero pool con pocket picks, one-trick alerts y winrate por parche
- Form strip (últimas 10 partidas)
- TrendChart de evolución de rendimiento
- Comparación directa entre dos jugadores

### Team Analysis
Análisis completo del equipo propio o rival:
- Roster y rendimiento individual
- Winrate por parche, por lado (attacking/defending), primer tower
- Objective Control: Fangtooth, Orb Prime, Seedlings, Genesis Core
- Tasas de conversión de ventajas y early death rate
- Hero pool colectivo y ban targets sugeridos

### Match Detail
Vista de partida con cuatro pestañas:
- **Scoreboard** — estadísticas completas de los 10 jugadores
- **Statistics** — 16 campos extendidos (daño P/M/T, healing, estructuras, multi-kills)
- **Timeline** — swim lanes de eventos con zoom y minimapa calibrado
- **Analysis** — Gold Diff, Deaths Before Objective, Heatmap de kills y wards

### Scrim Report / Battle Plan
- Informe pre-partida con Win Conditions prescriptivas
- Target Players por rol con threat score
- Objective Plan con timing medio por objetivo
- Intelligence Notes (alertas, oportunidades, ban targets) exportable a PDF/clipboard
- Modo Full Screen para proyección en sala

### Review Queue
- Creación y seguimiento de items de revisión por partido o jugador
- 8 estados de progreso, 8 categorías de causa táctica
- Team Goals y Player Goals con KPI tracking

### Analyst — Rules Engine
9 reglas deterministas que generan insights automáticos:
- Muerte crítica antes de objetivo
- Baja visión antes de objetivo
- Visión limpiada sin respuesta
- Prime no convertido
- Draft dependency
- Throw pattern
- Player slump
- Vision gaps
- Refuerzo positivo

### VOD & Replay Index
- Repositorio de VODs por partida con timestamps
- Filtros por equipo, rival y parche

### Administración de plataforma
- Gestión de usuarios, roles e invitaciones
- Sincronización de datos (jugadores, partidas, event stream, versiones)
- Data Quality panel — estado de sync, jugadores desactualizados, no sincronizables
- Audit logs de todas las acciones
- Restablecimiento de contraseñas

---

## Los tres pilares estratégicos

1. **Objective Intelligence** — Control de objetivos, setup, conversión, muertes previas
2. **Vision Intelligence** — Wards, cobertura antes de objetivos, limpieza de visión
3. **Pre-Match Intelligence** — Battle Plan, must-bans, amenazas por rol, win conditions

---

## Principios de producto

- **Prescripción antes que descripción** — cada pantalla responde "qué hace el staff con este dato"
- **Reglas antes que IA** — insights deterministas; no se destaca un dato sin evidencia calculada detrás
- **Review asistida, no sustituida** — la plataforma detecta patrones; el coach confirma la causa
- **Patch-aware** — datos filtrados por parche con aviso cuando la muestra mezcla versiones
- **Muestra mínima** — no se destacan WR ni pocket picks sin suficientes partidas
- **Bajo ruido** — dashboards y notificaciones solo muestran eventos críticos

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + TypeScript (compilado con Vite, servido como SPA estática) |
| Backend | Express + Node.js 22 + TypeScript |
| Base de datos | PostgreSQL 16 + TimescaleDB 2.27 + Prisma ORM |
| Auth | OAuth2 PKCE (pred.gg) + JWT interno con bcrypt (email/contraseña) |
| API externa | pred.gg GraphQL — partidas, jugadores, event stream |
| Infraestructura | Hetzner VPS · nginx 1.24 (SSL + reverse proxy) · Let's Encrypt · PM2 · GitHub Actions CI/CD |

---

## Modelo de acceso

- Acceso por invitación — no hay registro público
- Cada usuario pertenece a un equipo con un rol específico
- Los Platform Admins gestionan la plataforma completa
- Los datos de partidas se sincronizan automáticamente desde pred.gg con ventana de 3 meses
