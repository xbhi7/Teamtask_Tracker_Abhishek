import express from 'express';
/// <reference path="./types/express.d.ts" />
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth.routes';
import taskRoutes from './routes/task.routes';
import projectRoutes from './routes/project.routes';
import analyticsRoutes from './routes/analytics.routes';
import { errorHandler } from './middlewares/error.middleware';

const app = express();

// 1. Basic Middlewares
app.use(helmet()); // Security headers
app.use(cors({
  origin: '*', // For take-home convenience. In production, specify frontend domain.
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json()); // JSON parser
app.use(morgan('dev')); // Logger

// 2. Base API Router branch
const apiRouter = express.Router();
apiRouter.use('/auth', authRoutes);
apiRouter.use('/tasks', taskRoutes);
apiRouter.use('/projects', projectRoutes);
apiRouter.use('/analytics', analyticsRoutes);

// Mount under /api
app.use('/api', apiRouter);

// Health Check Route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date() });
});

// 3. Global Error Handler Middleware
app.use(errorHandler);

export default app;
