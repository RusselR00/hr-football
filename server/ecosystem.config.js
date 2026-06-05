module.exports = {
  apps: [{
    name: 'hr-football',
    script: 'index.js',
    watch: false,
    instances: 1,
    autorestart: true,
    max_restarts: 50,
    restart_delay: 1000,
    max_memory_restart: '500M',
    env: { NODE_ENV: 'production', PORT: 3001 },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
