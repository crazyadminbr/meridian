// ============================================================================
// ecosystem.config.js — конфиг PM2 (менеджер процессов Node.js)
//
// PM2 автоматически перезапускает сервер при падении, сохраняет логи,
// и поднимает процесс при перезагрузке VDS.
//
// Основные команды:
//   pm2 start ecosystem.config.js   — запустить
//   pm2 restart meridian            — перезапустить
//   pm2 stop meridian               — остановить
//   pm2 logs meridian               — просмотр логов в реальном времени
//   pm2 status                      — статус всех процессов
// ============================================================================

module.exports = {
  apps: [
    {
      name: 'meridian',                     // имя процесса в PM2
      script: 'server/server.js',           // путь к серверу (от корня репо)
      cwd: '/var/www/meridian',             // рабочая директория на сервере
      instances: 1,                         // 1 инстанс (можно 'max' для кластера)
      autorestart: true,                    // авторестарт при падении
      watch: false,                         // не следить за файлами (перезапуск — через git pull)
      max_memory_restart: '400M',           // перезапуск при утечке памяти
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      // Настройки логов
      out_file: '/var/log/meridian/out.log',
      error_file: '/var/log/meridian/err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};
