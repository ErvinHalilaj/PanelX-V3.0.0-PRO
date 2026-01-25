module.exports = {
  apps: [
    {
      name: 'panelx',
      script: 'tsx',
      args: 'server/index.ts',
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
        DATABASE_URL: 'postgresql://panelx:panelx123@localhost:5432/panelx'
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
