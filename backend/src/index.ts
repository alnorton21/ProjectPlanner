import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { getDb } from './database/db';
import importRouter from './routes/import';
import projectsRouter from './routes/projects';
import tasksRouter from './routes/tasks';
import ganttRouter from './routes/gantt';
import teamRouter from './routes/team';
import analyticsRouter from './routes/analytics';
import alertsRouter from './routes/alerts';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize database on startup
getDb();

// API routes
app.use('/api/import', importRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/gantt', ganttRouter);
app.use('/api/team', teamRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/alerts', alertsRouter);

// Serve frontend build in production
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Project Planner running at http://localhost:${PORT}`);
  console.log(`  Also accessible on your local network via your machine's IP address\n`);
});
