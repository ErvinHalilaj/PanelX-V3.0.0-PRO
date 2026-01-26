require('dotenv').config();

module.exports = {
  apps: [
    {
      name: 'panelx',
      script: 'npx',
      args: 'tsx server/index.ts',
      cwd: '/home/panelx/webapp',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      max_restarts: 10,
      min_uptime: '10s',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        HOST: '0.0.0.0',
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://panelx:panelx123@localhost:5432/panelx',
        SESSION_SECRET: process.env.SESSION_SECRET,
        COOKIE_SECURE: process.env.COOKIE_SECURE || 'false',
        LOG_LEVEL: process.env.LOG_LEVEL || 'info'
      },
      error_file: '/home/panelx/logs/error.log',
      out_file: '/home/panelx/logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
