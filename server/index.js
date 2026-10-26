import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, closeDb } from './db/index.js';
import { seedDemoData } from './db/seed.js';
import candidatesRouter from './routes/candidates.js';
import messagesRouter from './routes/messages.js';
import activityRouter from './routes/activity.js';
import agentRouter from './routes/agent.js';
import connectionsRouter from './routes/connections.js';
import { loadRealConnections } from './db/clean_data.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'client')));

app.use('/api/connections', connectionsRouter);
app.use('/api/candidates', candidatesRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/activity', activityRouter);
app.use('/api/agent', agentRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

app.use('/api/*', notFoundHandler);

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

app.use(errorHandler);

getDb();
loadRealConnections();

const server = app.listen(PORT, () => {
  console.log(`\n  ⚡ LinkedIn Outreach Agent`);
  console.log(`  ─────────────────────────`);
  console.log(`  Dashboard: http://localhost:${PORT}`);
  console.log(`  API:       http://localhost:${PORT}/api`);
  console.log(`  Health:    http://localhost:${PORT}/api/health\n`);
});

function shutdown() {
  console.log('\n[server] Shutting down...');
  server.close(() => {
    closeDb();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
