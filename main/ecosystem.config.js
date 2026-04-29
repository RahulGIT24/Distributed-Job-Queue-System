module.exports = {
  apps : [
    {
      name: "api",
      script: "dist/app.js",
      instances: 1,
      exec_mode: "fork",
    },
    {
      name: "janitor",
      script: "dist/lib/janitor.js",
      instances: 1,
      exec_mode: "fork",
    },
    {
      name: "queue-consumer",
      script: "pnpm", 
      args: "run consumer",
      instances:1,
      exec_mode: "cluster"
    }
  ]
}
