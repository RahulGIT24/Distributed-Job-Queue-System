module.exports = {
  apps : [
    {
      name: "queue-consumer",
      script: "pnpm", 
      args: "run consumer",
      instances:8,
      exec_mode: "cluster"
    }
  ]
}