import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { playersRouter } from './routes/players.js';
import { teamsRouter } from './routes/teams.js';
import { reportsRouter } from './routes/reports.js';
import { patchesRouter } from './routes/patches.js';
import { adminRouter } from './routes/admin.js';
import { errorHandler } from './middleware/error-handler.js';
import { disconnectDb } from './db.js';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Routes
app.use('/players', playersRouter);
app.use('/teams', teamsRouter);
app.use('/reports', reportsRouter);
app.use('/patches', patchesRouter);
app.use('/admin', adminRouter);

// Error handler (must be last)
app.use(errorHandler);

// Start server
let server: ReturnType<typeof app.listen> | undefined;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`[api] listening on http://localhost:${PORT}`);
    console.log(`[api] endpoints:`);
    console.log(`  GET  /health`);
    console.log(`  GET  /players/search?q=name`);
    console.log(`  GET  /players/:id`);
    console.log(`  POST /players/compare`);
    console.log(`  GET  /teams`);
    console.log(`  GET  /teams/:id`);
    console.log(`  POST /reports/scrim`);
    console.log(`  GET  /patches`);
    console.log(`  GET  /patches/latest`);
    console.log(`  POST /admin/sync-data`);
    console.log(`  GET  /admin/sync-logs`);
  });
}

// Graceful shutdown
function shutdown() {
  console.log('\n[api] shutting down...');
  if (server) {
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
  } else {
    disconnectDb().then(() => process.exit(0));
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
