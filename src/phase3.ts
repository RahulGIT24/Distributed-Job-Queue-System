import { consumer, producer } from "./lib/redis";
import { Message } from "./phase1";
import { delayFn } from "./phase2";

const QUEUE_PENDING = "queue:pending";
const QUEUE_PROCESSING = "queue:processing";
const QUEUE_DLQ = "queue:dead_letters";


const HEARTBEAT_INTERVAL = 30 * 1000;

interface extendedTask extends Message {
    retries: number,
}
const MAX_RETRIES = 3;

const reliableProducer = async () => {
    let counter = 0;

    console.log("[PRODUCER] Ready For Pushing Tasks.....")

    while (true) {
        counter++;
        let task: extendedTask = {
            id: counter,
            task: "Processing Batch of Id " + counter,
            retries: 0
        }
        const taskString = JSON.stringify(task);
        await producer.lpush(QUEUE_PENDING, taskString);

        console.log("[PRODUCED TASK] of Id " + task.id);
        await delayFn(3000)
    }
}

const reliableConsumer = async () => {
    console.log("[CONSUMER] Connected. Waiting for reliable connections.");
    while (true) {
        // use BLMOVE to atomically pop and push to processing queue
        // const taskString = await consumer.blmove(
        //     QUEUE_PENDING, QUEUE_PROCESSING, "RIGHT", "LEFT", 0
        // );

        // instead of BLMOVE one should use zsets it will help janitor to recover stuck tasks without allowing duplication based on score value
        // for that purpose I am sacrificing atomicity for now
        const result = await consumer.brpop(QUEUE_PENDING, 0);

        if (result) {
            const taskString = result[1];
            const task = JSON.parse(taskString);
            console.log(`[Consumer] Processing: ${task.id}`);
            const startTime = Date.now()

            await consumer.zadd(QUEUE_PROCESSING, startTime, taskString);
            const heartbeatTimer = setInterval(async () => {
                try {
                    // Overwrite the old score with the new current time
                    await consumer.zadd(QUEUE_PROCESSING, Date.now(), taskString);
                    console.log(`[Heartbeat] Extended lease for task ${task.id}`);
                } catch (err) {
                    console.error(`[Heartbeat Error] Failed to update task ${task.id}`, err);
                }
            }, HEARTBEAT_INTERVAL);

            try {
                await delayFn(3500);

                // if failure happens here the task will be stuck in queue:processing
                if (Math.random() < 0.2) {
                    throw new Error("FATAL SERVER CRASH!");
                }
                console.log(`[Consumer] Success: ${task.id}`);

                // now we will remove from zset after processing
                await consumer.zrem(QUEUE_PROCESSING, taskString);

                // await consumer.lrem(QUEUE_PROCESSING, taskString, 1);
            } catch (error) {
                console.log(`[CONSUMER] Error on task ${task.id}`);
                await consumer.zrem(QUEUE_PROCESSING, taskString);
                if (task.retries >= MAX_RETRIES) {
                    await consumer.lpush(QUEUE_DLQ, taskString);
                    console.log(`DLQ] Task ${task.id} routed to DLQ.`);
                } else {
                    task.retries += 1;
                    await consumer.lpush(QUEUE_PENDING, JSON.stringify(task));
                    console.log(`[Retry] Task ${task.id} queued for attempt ${task.retries}`);
                }
            } finally {
                clearInterval(heartbeatTimer)
            }
        }
    }
}

reliableProducer();
reliableConsumer();