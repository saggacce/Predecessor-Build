// Load .env from project root before anything else.
// process.loadEnvFile is built into Node.js 20.12+ — no extra dependencies.
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';
try {
  process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env'));
} catch {
  // .env not present — rely on system environment variables
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { join } from 'path';
import { playersRouter } from './routes/players.js';
import { teamsRouter } from './routes/teams.js';
import { matchesRouter } from './routes/matches.js';
import { heroMetaRouter } from './routes/hero-meta.js';
import { reportsRouter } from './routes/reports.js';
import { patchesRouter } from './routes/patches.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { internalAuthRouter } from './routes/internal-auth.js';
import { invitationsRouter } from './routes/invitations.js';
import { analystRouter } from './routes/analyst.js';
import { reviewRouter } from './routes/review.js';
import { vodRouter } from './routes/vod.js';
import { mapZonesRouter } from './routes/map-zones.js';
import { syncRouter } from './routes/sync.js';
import { profileRouter } from './routes/profile.js';
import { feedbackRouter } from './routes/feedback.js';
import { errorHandler } from './middleware/error-handler.js';
import { db, disconnectDb } from './db.js';
import { logger } from './logger.js';
import cron from 'node-cron';
import { cleanupOldData } from './services/sync-service.js';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // CSP disabled until HTTPS is configured — upgrade-insecure-requests blocks
  // all fetch() calls on plain HTTP. Re-enable with HTTPS_ENABLED=true.
  contentSecurityPolicy: process.env.HTTPS_ENABLED === 'true' ? undefined : false,
}));
app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '400kb' }));
app.use(cookieParser());

// HTTP access log — skip health checks to avoid noise
app.use(pinoHttp({
  logger,
  autoLogging: { ignore: (req) => req.url === '/health' },
}));

// Production: strip /api prefix added by frontend (mirrors Vite dev proxy)
if (process.env.NODE_ENV === 'production') {
  app.use((req, _res, next) => {
    if (req.url.startsWith('/api/')) req.url = req.url.slice(4);
    else if (req.url === '/api') req.url = '/';
    next();
  });
}

// Production: serve Vite-built frontend BEFORE API routes so browser navigation
// to SPA paths (/profile, /matches, etc.) serves index.html, not the API handler.
if (process.env.NODE_ENV === 'production') {
  const distPath = join(dirname(fileURLToPath(import.meta.url)), '../../web/dist');
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    // Only intercept browser navigation (text/html) — let API calls pass through
    if (req.accepts('html')) return res.sendFile(join(distPath, 'index.html'));
    next();
  });
}

app.use('/hero-meta', heroMetaRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.use('/auth', authRouter);
app.use('/internal-auth', internalAuthRouter);
app.use('/invitations', invitationsRouter);
app.use('/players', playersRouter);
app.use('/teams', teamsRouter);
app.use('/matches', matchesRouter);
app.use('/reports', reportsRouter);
app.use('/patches', patchesRouter);
app.use('/admin', adminRouter);
app.use('/analysis', analystRouter);
app.use('/review', reviewRouter);
app.use('/vod', vodRouter);
app.use('/map-zones', mapZonesRouter);
app.use('/sync', syncRouter);
app.use('/profile', profileRouter);
app.use('/feedback', feedbackRouter);

app.use(errorHandler);

// Monthly data retention cleanup — runs on the 1st of every month at 03:00 AM
if (process.env.NODE_ENV !== 'test') {
  cron.schedule('0 3 1 * *', async () => {
    logger.info('cron: starting monthly data retention cleanup');
    try {
      const result = await cleanupOldData(db);
      logger.info(result, 'cron: monthly cleanup complete');
    } catch (err) {
      logger.error({ err }, 'cron: monthly cleanup failed');
    }
  });
}

let server: ReturnType<typeof app.listen> | undefined;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    logger.info({ port: PORT }, 'api server started');
    logger.info('endpoints: GET /health | GET /players/search | POST /players/sync | GET /players/:id | POST /players/compare | GET /teams | GET /teams/:id | POST /reports/scrim | GET /patches | GET /patches/latest | POST /admin/sync-versions | POST /admin/sync-stale | GET /admin/sync-logs');
  });
}

function shutdown() {
  logger.info('shutting down gracefully');
  if (server) {
    server.close(async () => {
      await disconnectDb().catch((err) => logger.error({ err }, 'error disconnecting db'));
      process.exit(0);
    });
  } else {
    Promise.resolve(disconnectDb())
      .catch((err) => logger.error({ err }, 'error disconnecting db'))
      .finally(() => process.exit(0));
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
