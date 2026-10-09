// PM2 process file. Start with: npm run pm2:start
module.exports = {
  apps: [
    {
      name: "codecrafter-api",
      script: "server.js",
      cwd: __dirname,
      // One worker per CPU core; PM2 load-balances between them.
      instances: process.env.PM2_INSTANCES || "max",
      exec_mode: "cluster",
      // server.js sends "ready" once MongoDB is connected.
      wait_ready: true,
      listen_timeout: 20000,
      kill_timeout: 10000,
      max_memory_restart: "400M",
      exp_backoff_restart_delay: 200,
      time: true,
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
