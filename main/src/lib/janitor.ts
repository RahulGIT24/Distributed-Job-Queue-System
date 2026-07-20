import { janitorRedis } from "./redis";
import 'dotenv/config'

const QUEUE_PENDING = process.env.QUEUE_PENDING!;
const QUEUE_PROCESSING = process.env.QUEUE_PROCESSING!;

const STALL_TIMEOUT = 5 * 60 * 1000;

// Sweeps queue:processing for tasks whose lease has expired and re-queues
// them. Exported (rather than inlined in the interval) so it can be
// exercised directly in tests without waiting on a real timer.
export async function sweepStuckTasks(now: number = Date.now()): Promise<number> {
    const threshold = now - STALL_TIMEOUT;

    const stuckTasks = await janitorRedis.zrange(
        QUEUE_PROCESSING, 0, threshold, "BYSCORE"
    )

    if (stuckTasks.length == 0) {
        return 0; // every task is fine
    }

    console.log(`[Janitor] Found ${stuckTasks.length} tasks. Pushing Now in Pending Queue`)

    let rescuedCount = 0;
    for (const taskString of stuckTasks) {
        const task = JSON.parse(taskString);

        // works for multiple janitor instance
        const removedCount = await janitorRedis.zrem(QUEUE_PROCESSING, taskString);
        if (removedCount === 1) {
            task.retries += 1
            const updatedTaskString = JSON.stringify(task);
            await janitorRedis.lpush(QUEUE_PENDING, updatedTaskString);
            rescuedCount++;
            console.log(`🧹 [Janitor] Rescued ${task.id}.`);
        }
    }

    return rescuedCount;
}

function runJanitor() {
    console.log("[Janitor] Started. Looking for Jobs.")

    setInterval(() => {
        sweepStuckTasks().catch((err) => console.error("[Janitor] Sweep failed:", err));
    }, 10000)
}

if (require.main === module) {
    runJanitor()
}