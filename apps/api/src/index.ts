import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { playersRouter } from './routes/players.js';
import { teamsRouter } from './routes/teams.js';
import { reportsRouter } from './routes/reports.js';
import { patchesRouter } from './routes/patches.js';
import { adminRouter } from './routes/admin.js';
import { errorHandler } from './middleware/error-handler.js';
import { disconnectDb } from './db.js';
import { logger } from './logger.js';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

app.use(helmet());
app.use(cors());
app.use(express.json());

// HTTP access log — skip health checks to avoid noise
app.use(pinoHttp({
  logger,
  autoLogging: { ignore: (req) => req.url === '/health' },
}));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.use('/players', playersRouter);
app.use('/teams', teamsRouter);
app.use('/reports', reportsRouter);
app.use('/patches', patchesRouter);
app.use('/admin', adminRouter);

app.use(errorHandler);

let server: ReturnType<typeof app.listen> | undefined;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    logger.info({ port: PORT }, 'api server started');
    logger.info('endpoints: GET /health | GET /players/search | GET /players/:id | POST /players/compare | GET /teams | GET /teams/:id | POST /reports/scrim | GET /patches | GET /patches/latest | POST /admin/sync-data | GET /admin/sync-logs');
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
