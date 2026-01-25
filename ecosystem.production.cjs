module.exports = {
  apps: [
    {
      name: 'panelx-production',
      script: 'server/index.ts',
      interpreter: 'node',
      interpreter_args: '--loader tsx',
      instances: 'max', // Use all CPU cores
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        SESSION_SECRET: process.env.SESSION_SECRET || 'CHANGE_THIS_IN_PRODUCTION',
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/panelx',
        COOKIE_SECURE: 'false' // Set to 'true' if using HTTPS
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      listen_timeout: 10000,
      kill_timeout: 5000
    }
  ]
};
