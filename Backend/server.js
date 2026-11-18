require('./utils/envLoader');
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Server } = require('socket.io');
const auctionRouter = require('./routes/auction');
const { buildPublicSnapshot, hydrateFromSupabaseIfAvailable } = require('./data/store');

hydrateFromSupabaseIfAvailable().catch(() => {});

const app = express();
const server = http.createServer(app);
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 5000);
const ADMIN_KEY = process.env.ADMIN_KEY || 'hogwarts-admin';

const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

app.set('io', io);
app.set('adminKey', ADMIN_KEY);

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: '4mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api', auctionRouter);
// Also mount at root so Vercel service rewrites work whether /api prefix is preserved or stripped
if (process.env.VERCEL) {
  app.use('/', auctionRouter);
}

// Serve built frontend locally if available (enables single-port LAN hosting)
const distDir = path.join(__dirname, '..', 'Frontend', 'dist');
if (!process.env.VERCEL && fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    const indexFile = path.join(distDir, 'index.html');
    if (fs.existsSync(indexFile)) {
      return res.sendFile(indexFile);
    }
    return next();
  });
}

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  socket.on('request:state', () => {
    socket.emit('auction:update', buildPublicSnapshot());
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

if (!process.env.VERCEL && require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log('\n🏰 Coders Cup — FAST NUCES Karachi Live Auction Backend');
    console.log(`   Host      : ${HOST}`);
    console.log(`   URL       : http://${HOST}:${PORT}`);
    console.log(`   API       : http://${HOST}:${PORT}/api/state`);
    console.log(`   Health    : http://${HOST}:${PORT}/health`);
  });
}

module.exports = app;
