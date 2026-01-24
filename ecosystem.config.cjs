module.exports = {
  apps: [{
    name: 'panelx',
    script: 'npm',
    args: 'run dev',
    env: {
      NODE_ENV: 'development',
      PORT: '5000',
      DATABASE_URL: 'postgresql://user:password@localhost:5432/panelx',
      SESSION_SECRET: 'panelx-super-secret-key-change-in-production'
    },
    watch: false,
    instances: 1,
    exec_mode: 'fork'
  }]
};
