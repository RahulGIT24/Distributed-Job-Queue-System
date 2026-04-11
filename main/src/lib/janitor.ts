import { janitorRedis } from "./redis";
import 'dotenv/config'

const QUEUE_PENDING = process.env.QUEUE_PENDING!;
const QUEUE_PROCESSING = process.env.QUEUE_PROCESSING!;

const STALL_TIMEOUT = 5 * 60 * 1000;

async function runJanitor() {
    console.log("[Janitor] Started. Looking for Jobs.")

    setInterval(async () => {
        const now = Date.now();
        const threshold = now - STALL_TIMEOUT;

        const stuckTasks = await janitorRedis.zrange(
            QUEUE_PROCESSING, 0, threshold, "BYSCORE"
        )

        if (stuckTasks.length == 0) {
            return; // every task is fine
        }

        console.log(`[Janitor] Found ${stuckTasks.length} tasks. Pushing Now in Pending Queue`)

        for (const taskString of stuckTasks) {
            const task = JSON.parse(taskString);

            // works for multiple janitor instance
            const removedCount = await janitorRedis.zrem(QUEUE_PROCESSING, taskString);
            if (removedCount === 1) {
                task.retries += 1
                const updatedTaskString = JSON.stringify(task);
                await janitorRedis.lpush(QUEUE_PENDING, updatedTaskString);
                console.log(`🧹 [Janitor] Rescued ${task.id}.`);
            }
        }

    }, 10000)
}

runJanitor()