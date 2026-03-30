import express from 'express';
import cors from 'cors';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import pool from './db/pool.js';
import { startScheduler, runIngestion } from './ingestion/scheduler.js';
import checkinsRouter from './routes/checkins.js';
import garbageReportsRouter from './routes/garbageReports.js';
import collectionPointsRouter from './routes/collectionPoints.js';
import leaderboardRouter from './routes/leaderboard.js';
import residentsRouter from './routes/residents.js';
import uploadRouter from './routes/upload.js';
import mapStatsRouter from './routes/mapStats.js';
import binRequestsRouter from './routes/binRequests.js';
import creditsRouter from './routes/credits.js';
import residentialAreasRouter from './routes/residentialAreas.js';

const app = express();

const corsOrigin = process.env['CORS_ORIGIN'];
const allowedOrigins = corsOrigin ? corsOrigin.split(',').map(s => s.trim()) : null;
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // If no CORS_ORIGIN set, allow all
    if (!allowedOrigins) return callback(null, true);
    // Allow exact matches
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow any vercel.app subdomain (covers preview deployments)
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(requestIdMiddleware);

app.post('/api/admin/ingest', async (_req, res) => {
  try {
    await runIngestion();
    const result = await pool.query(
      `SELECT dataset_name, last_ingested, record_count, status FROM dataset_ingestion_status`
    );
    res.json({ data: { triggered: true, datasets: result.rows } });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/health', (_req, res) => {
  res.json({ data: { status: 'ok' } });
});

app.use('/api/checkins', checkinsRouter);
app.use('/api/garbage-reports', garbageReportsRouter);
app.use('/api/collection-points', collectionPointsRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/residents', residentsRouter);
app.use('/api/upload-url', uploadRouter);
app.use('/api/map/stats', mapStatsRouter);
app.use('/api/bin-requests', binRequestsRouter);
app.use('/api/credits', creditsRouter);
app.use('/api/residential-areas', residentialAreasRouter);

// Global error handler — must be last
app.use(errorHandler);

const PORT = process.env['PORT'] ?? 3000;

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
  startScheduler();
});

export default app;
