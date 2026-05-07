module.exports = {
  apps: [
    {
      name: 'comando-pulso',
      script: 'server.js',
      cwd: '/var/www/comando-pulso',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
