import { Router } from "express";
import { getApiStats, getFailedTasks, pushTask, retryDLQTasks, stressTest } from "../controllers/apiController";

const router = Router();

router.get('/stats', getApiStats)
router.get('/dlq', getFailedTasks)
router.post('/dlq/retry', retryDLQTasks)
router.post('/tasks', pushTask)
router.post('/stress', stressTest)

export default router;