import { Router } from "express";
import { getApiStats, getFailedTasks, pushTask, retryDLQTasks } from "../controllers/apiController";

const router = Router();

router.get('/stats', getApiStats)
router.get('/dlq', getFailedTasks)
router.post('/dlq/retry', retryDLQTasks)
router.post('/tasks', pushTask)

export default router;