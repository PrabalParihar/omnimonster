module.exports = {
  apps: [
    {
      name: 'swap-sage-frontend',
      script: 'npm',
      args: 'start',
      cwd: './apps/frontend',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    },
    {
      name: 'swap-sage-resolver',
      script: 'npx',
      args: 'tsx src/index.ts',
      cwd: './services/resolver',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/resolver-error.log',
      out_file: './logs/resolver-out.log',
      log_file: './logs/resolver-combined.log',
      time: true,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      // Restart if crashes
      restart_delay: 5000,
      max_restarts: 10
    }
  ]
}