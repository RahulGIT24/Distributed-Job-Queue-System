export type Message = {
    id: number,
    task: string
}


export const messages: Message[] = []
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const producer = async () => {
    let counter: number = 0;
    while (true) {
        counter++;
        const newTask: Message = {
            id: counter,
            task: "Process Data Batch of Counter No " + counter
        }
        messages.push(newTask);
        console.log("[PRODUCER] Enqueued task " + newTask.id);
        await delay(3000);
    }
}

const consumer = async () => {
    console.log("[CONSUMER] Started. Waiting for Jobs to Process");
    while (true) {
        if(messages.length>0){
            const currentTask = messages.shift();
            if(currentTask){
                console.log(`[Consumer] Working on: ${currentTask.id}`);
                await delay(3500);
                console.log(`[Consumer] Finished: ${currentTask.id}`);
            }
        }else{
            await delay(100);
        }
    }
}

producer();
consumer();