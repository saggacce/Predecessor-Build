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
import { reportsRouter } from './routes/reports.js';
import { patchesRouter } from './routes/patches.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { errorHandler } from './middleware/error-handler.js';
import { disconnectDb } from './db.js';
import { logger } from './logger.js';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '400kb' }));
app.use(cookieParser());

// HTTP access log — skip health checks to avoid noise
app.use(pinoHttp({
  logger,
  autoLogging: { ignore: (req) => req.url === '/health' },
}));

// Serve local hero/item/role assets — avoids dependency on pred.gg CDN
const assetsRoot = join(fileURLToPath(import.meta.url), '../../../../assets');
app.use('/heroes', express.static(join(assetsRoot, 'heroes')));
app.use('/items', express.static(join(assetsRoot, 'items')));
app.use('/icons', express.static(join(assetsRoot, 'icons')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.use('/auth', authRouter);
app.use('/players', playersRouter);
app.use('/teams', teamsRouter);
app.use('/matches', matchesRouter);
app.use('/reports', reportsRouter);
app.use('/patches', patchesRouter);
app.use('/admin', adminRouter);

app.use(errorHandler);

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
