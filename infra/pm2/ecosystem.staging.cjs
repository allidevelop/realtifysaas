// PM2 — процессы STAGING/MVP. Порты из .env (WEB_PORT/ENGINE_PORT), по умолч. 3100/8100.
//   pm2 start infra/pm2/ecosystem.staging.cjs && pm2 save
// engine — внутренний (127.0.0.1), web зовёт его через ENGINE_BASE_URL.
// Перед стартом: pnpm i && pnpm --filter web build; (cd apps/engine && uv sync).

const WEB_PORT = process.env.WEB_PORT || '3100'
const ENGINE_PORT = process.env.ENGINE_PORT || '8100'

module.exports = {
  apps: [
    {
      name: 'realtify-staging-web',
      cwd: './apps/web',
      script: 'pnpm',
      args: 'start --port ' + WEB_PORT,
      interpreter: 'none',
      env: { NODE_ENV: 'production', PORT: WEB_PORT },
      autorestart: true,
      max_memory_restart: '1G',
      out_file: './logs/web.out.log',
      error_file: './logs/web.err.log',
    },
    {
      name: 'realtify-staging-engine',
      cwd: './apps/engine',
      script: 'uv',
      args: `run uvicorn app.main:app --host 127.0.0.1 --port ${ENGINE_PORT} --workers 2`,
      interpreter: 'none',
      autorestart: true,
      max_memory_restart: '700M',
      out_file: './logs/engine.out.log',
      error_file: './logs/engine.err.log',
    },
    {
      name: 'realtify-staging-bot',
      cwd: './apps/engine',
      script: 'uv',
      args: 'run python -m bot.main',
      interpreter: 'none',
      // Без TELEGRAM_BOT_TOKEN бот graceful-выходит → НЕ перезапускаем (иначе петля).
      autorestart: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      max_memory_restart: '300M',
      out_file: './logs/bot.out.log',
      error_file: './logs/bot.err.log',
    },
  ],
}
