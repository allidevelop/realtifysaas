// PM2 — процессы прода (ТЗ §14). Запуск из корня репо:
//   pm2 start infra/pm2/ecosystem.config.cjs
//   pm2 save && pm2 startup        # автозапуск при ребуте
//   pm2 install pm2-logrotate      # ротация логов (ТЗ §14 — сразу)
//
// Перед стартом: pnpm i && pnpm --filter web build; cd apps/engine && uv sync.
// Переменные окружения — из корневого .env (web грузит сам; engine — через config).

module.exports = {
  apps: [
    {
      name: 'realtify-web',
      cwd: './apps/web',
      script: 'pnpm',
      args: 'start', // next start (порт 3000)
      interpreter: 'none',
      env: { NODE_ENV: 'production', PORT: '3000' },
      autorestart: true,
      max_memory_restart: '1G',
      out_file: './logs/web.out.log',
      error_file: './logs/web.err.log',
    },
    {
      name: 'realtify-engine',
      cwd: './apps/engine',
      script: 'uv',
      args: 'run uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2',
      interpreter: 'none',
      autorestart: true,
      max_memory_restart: '700M',
      out_file: './logs/engine.out.log',
      error_file: './logs/engine.err.log',
    },
    {
      name: 'realtify-bot',
      cwd: './apps/engine',
      script: 'uv',
      args: 'run python -m bot.main',
      interpreter: 'none',
      autorestart: true,
      max_memory_restart: '300M',
      out_file: './logs/bot.out.log',
      error_file: './logs/bot.err.log',
    },
  ],
}
