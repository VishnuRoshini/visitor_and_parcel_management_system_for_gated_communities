import express, { Application } from 'express';
import cors from 'cors';
import { createServer, Server as HTTPServer } from 'http';
import config from './config';
import routes from './routes';
import { errorHandler, notFoundHandler, generalLimiter } from './middlewares';
import { initializeSocket } from './socket';
import { EmailService } from './services';

// Create Express app
const app: Application = express();

// Create HTTP server
const httpServer: HTTPServer = createServer(app);

// Initialize Socket.IO
initializeSocket(httpServer);

// Initialize Email Service
EmailService.initialize().catch(console.error);

// =====================================================
// Middleware
// =====================================================

// CORS
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// General rate limiting (100 requests per 15 minutes)
app.use('/api', generalLimiter);

// Request logging (development)
if (config.nodeEnv === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`);
    next();
  });
}

// =====================================================
// Routes
// =====================================================

app.use('/api', routes);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'Visitor & Parcel Management API',
    version: '1.0.0',
    status: 'Running',
    docs: '/api/health',
  });
});

// =====================================================
// Error Handling
// =====================================================

app.use(notFoundHandler);
app.use(errorHandler);

// =====================================================
// Start Server
// =====================================================

const PORT = config.port;

httpServer.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${config.nodeEnv}`);
  console.log(`🔌 Socket.IO enabled`);
  console.log(`🌐 CORS origin: ${config.corsOrigin}`);
  console.log('='.repeat(50));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

export default app;
