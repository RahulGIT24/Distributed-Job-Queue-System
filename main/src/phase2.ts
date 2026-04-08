import { consumer, producer } from "./lib/redis";
import { Message } from "./phase1";

export const delayFn = (ms: number) => new Promise(res => setTimeout(res, ms));
const QUEUE_NAME = "distributed_queue"

async function producer1() {
    let counter = 0;
    while (true) {
        counter++;
        const newTask: Message = {
            id: counter,
            task: "PROCESS BATCH NUMBER " + counter
        }
        const taskStr = JSON.stringify(newTask);
        await producer.lpush(QUEUE_NAME, taskStr);

        await delayFn(3000);
    }
}

async function consumer1() {
    console.log("[CONSUMER] Connected. Waiting for tasks.....")
    while (true) {
        const task = await consumer.brpop(QUEUE_NAME,0)
        if(task){
            const currentTask = JSON.parse(task[1]);
            console.log("[CONSUMER] Processed Task ", currentTask.id)
            await delayFn(3000);
            console.log(`[Consumer] Finished: ${currentTask.id}`);
        }
    }
}


// producer1();
// consumer1();