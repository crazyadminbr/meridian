#!/bin/bash
# ============================================================================
# deploy.sh — скрипт обновления форума на VDS
# ============================================================================
set -e

APP_DIR="/var/www/meridian"
LOG_DIR="/var/log/meridian"

echo "🩸 Деплой форума «Кровавый Меридиан»..."
echo "   $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

cd "$APP_DIR"

echo "📥 Получаем обновления из GitHub..."
git pull origin main

echo "📦 Обновляем зависимости..."
cd server && npm install --omit=dev --no-audit --no-fund
cd ..

mkdir -p "$LOG_DIR"

# Применяем конфиг Nginx если он изменился
if ! diff -q nginx.conf /etc/nginx/sites-available/forum.ylamanager.ru > /dev/null 2>&1; then
  echo "🔧 Обновляем конфиг Nginx..."
  cp nginx.conf /etc/nginx/sites-available/forum.ylamanager.ru
  nginx -t && systemctl reload nginx
  echo "   Nginx перезагружен"
fi

echo "🔄 Перезапускаем сервер..."
if pm2 describe meridian > /dev/null 2>&1; then
  pm2 reload ecosystem.config.js --update-env
else
  pm2 start ecosystem.config.js
fi

echo ""
echo "✅ Деплой завершён!"
echo "   pm2 status  |  pm2 logs meridian"
