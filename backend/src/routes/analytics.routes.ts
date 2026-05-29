import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticateToken, analyticsController.getAnalytics);

export default router;
