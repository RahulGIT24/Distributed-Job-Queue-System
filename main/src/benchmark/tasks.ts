import { producer } from "../lib/redis";
import 'dotenv/config';

const QUEUE_PENDING = process.env.QUEUE_PENDING!
const TOTAL_TASKS = 10000; 

async function runBenchmark() {
    console.log(`Starting Benchmark: Pushing ${TOTAL_TASKS} tasks...`);
    const start = Date.now();

    for (let i = 0; i < TOTAL_TASKS; i++) {
        const task = {
            id: `bench-${i}`,
            task: `Benchmark Task #${i}`,
            retries: 0
        };
        await producer.lpush(QUEUE_PENDING, JSON.stringify(task));
        
        if (i % 1000 === 0) console.log(`Buffered ${i} tasks...`);
    }

    const end = Date.now();
    console.log(`Finished pushing ${TOTAL_TASKS} tasks in ${end - start}ms`);
    process.exit(0);
}

runBenchmark();