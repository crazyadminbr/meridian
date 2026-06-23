#!/bin/bash
# ============================================================================
# deploy.sh — скрипт обновления форума на VDS
#
# Запускается на сервере после git pull, обновляет зависимости и
# перезапускает PM2 без даунтайма.
#
# Использование:
#   chmod +x deploy.sh
#   ./deploy.sh
# ============================================================================

set -e  # остановить при любой ошибке

APP_DIR="/var/www/meridian"
LOG_DIR="/var/log/meridian"

echo "🩸 Деплой форума «Кровавый Меридиан»..."
echo "   $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Переходим в директорию приложения
cd "$APP_DIR"

# Подтягиваем последние изменения из GitHub
echo "📥 Получаем обновления из GitHub..."
git pull origin main

# Устанавливаем/обновляем зависимости (только если package.json изменился)
echo "📦 Обновляем зависимости..."
cd server && npm install --omit=dev --no-audit --no-fund
cd ..

# Создаём директорию логов если не существует
mkdir -p "$LOG_DIR"

# Перезапускаем процесс (PM2 сделает это без даунтайма)
echo "🔄 Перезапускаем сервер..."
if pm2 describe meridian > /dev/null 2>&1; then
    pm2 reload ecosystem.config.js --update-env
else
    pm2 start ecosystem.config.js
fi

echo ""
echo "✅ Деплой завершён успешно!"
echo "   Статус: pm2 status"
echo "   Логи:   pm2 logs meridian"
