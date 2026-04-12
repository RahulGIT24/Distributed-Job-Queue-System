import { Request, Response } from "express"
import { producer } from "../lib/redis"
import { runBenchmark } from "../benchmark/tasks"

const pending_queue = process.env.QUEUE_PENDING!
const processing_queue = process.env.QUEUE_PROCESSING!
const dead_letter = process.env.QUEUE_DLQ!

const getApiStats = async (req: Request, res: Response) => {
    try {
        const pendingCount = await producer.llen(pending_queue)

        const dlqCount = await producer.llen(dead_letter);

        const processingCount = await producer.zcard(processing_queue);

        res.json({
            pendingCount, dlqCount, processingCount, timeStamp: Date.now()
        })
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: "Internal Server Error" });
    }
}

const getFailedTasks = async (req: Request, res: Response) => {
    try {
        const rawTasks = await producer.lrange(dead_letter, 0, 99);
        const tasks = rawTasks.map((task) => JSON.parse(task));

        res.json({ tasks });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
}

const retryDLQTasks = async (req: Request, res: Response) => {
    try {
        let count = 0;
        let taskString = await producer.rpop(dead_letter);
        while (taskString) {
            if (!taskString) return;
            const task = JSON.parse(taskString);
            task.retries = 0; // resetting retries for a fair shot
            await producer.lpush(pending_queue, JSON.stringify(task));
            taskString = await producer.rpop(dead_letter);
        }
        res.json({ message: `Successfully re-queued ${count} tasks.` });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
}

const pushTask = async(req:Request,res:Response)=>{
    try {
        const { taskName } = req.body;
        const newTask = {
            id: `manual-${Date.now()}`,
            task: taskName || "Manual Override Task",
            retries: 0
        };

        await producer.lpush(pending_queue, JSON.stringify(newTask));
        
        res.json({ message: "Task injected successfully", task: newTask });
    } catch (error) {
        res.status(500).json({ error: "Failed to inject task" });
    }
}

const stressTest = async(req:Request,res:Response)=>{
    try {
        await runBenchmark()
        res.json({ message: "Stress test injected successfully"});
    } catch (error) {
        res.status(500).json({ error: "Failed to run benchmark" });
    }
}

export { getApiStats, getFailedTasks, retryDLQTasks,pushTask,stressTest }