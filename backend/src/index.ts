import 'dotenv/config';
import express from 'express';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import pool from './db/pool.js';
import { startScheduler } from './ingestion/scheduler.js';
import checkinsRouter from './routes/checkins.js';
import garbageReportsRouter from './routes/garbageReports.js';
import collectionPointsRouter from './routes/collectionPoints.js';
import leaderboardRouter from './routes/leaderboard.js';
import residentsRouter from './routes/residents.js';
import uploadRouter from './routes/upload.js';

const app = express();

app.use(express.json());
app.use(requestIdMiddleware);

app.get('/health', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT dataset_name, last_ingested, record_count, status FROM dataset_ingestion_status`
    );
    res.json({ data: { status: 'ok', datasets: result.rows } });
  } catch {
    res.json({ data: { status: 'ok', datasets: [] } });
  }
});

app.use('/checkins', checkinsRouter);
app.use('/garbage-reports', garbageReportsRouter);
app.use('/collection-points', collectionPointsRouter);
app.use('/leaderboard', leaderboardRouter);
app.use('/residents', residentsRouter);
app.use('/upload-url', uploadRouter);

// Global error handler — must be last
app.use(errorHandler);

const PORT = process.env['PORT'] ?? 3000;

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
  startScheduler();
});

export default app;
