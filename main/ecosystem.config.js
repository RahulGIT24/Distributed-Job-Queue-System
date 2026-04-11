module.exports = {
  apps : [
    {
      name: "queue-consumer",
      script: "node ./dist/runConsumer.js",
      instances: 4, 
      exec_mode: "cluster" 
    },
    {
      name: "queue-janitor",
      script: "node ./dist/lib/janitor.js",
      instances: 1 
    },
    {
      name: "queue-api-dashboard",
      script: "pnpm run dev",
      instances: 1
    }
  ]
}