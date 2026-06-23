# 🔧 HOTFIX — Исправление: нет стилей, медленная загрузка

## Причины проблемы

1. **Google Fonts** блокировал рендер — CSS не применялся пока шрифты не загрузятся
2. **Nginx не раздавал статику** — всё шло через Node.js (медленнее)
3. **background-attachment: fixed** — лагало на мобильных

## Быстрое исправление (на сервере)

### Вариант A: Обновить через git (рекомендуется)

```bash
cd /var/www/meridian
git pull origin main

# Применить новый nginx.conf
sudo cp nginx.conf /etc/nginx/sites-available/forum.ylamanager.ru
sudo nginx -t && sudo systemctl reload nginx

# Перезапустить Node.js
pm2 reload ecosystem.config.js
```

### Вариант B: Если git pull не работает — патч вручную

```bash
# 1. Убрать Google Fonts из CSS (первые 6 строк заменить на пустой комментарий)
cd /var/www/meridian/client
sed -i '/@import url.*googleapis/d' style.css

# Проверить что строка удалена:
head -8 style.css
# Если строка исчезла — шрифты больше не блокируют загрузку страницы

# 2. Обновить Nginx конфиг
sudo cp /var/www/meridian/nginx.conf /etc/nginx/sites-available/forum.ylamanager.ru
sudo nginx -t
sudo systemctl reload nginx

# 3. Перезапустить Node.js
pm2 restart meridian
```

## Проверка после фикса

```bash
# Проверить что Nginx отдаёт статику (должен быть заголовок Cache-Control)
curl -I https://forum.ylamanager.ru/style.css

# Проверить что Google Fonts больше не загружается (нет строки @import)
curl -s https://forum.ylamanager.ru/style.css | head -10

# Посмотреть логи если что-то не работает
pm2 logs meridian --lines 30
sudo nginx -t
```

## Почему Nginx раздаёт статику быстрее Node.js

Nginx написан на C и специально оптимизирован для раздачи файлов:
- Использует sendfile() — передаёт файл напрямую из ядра ОС, минуя Node.js
- Встроенное gzip-сжатие CSS/JS (уменьшает объём в 5-10 раз)
- Кэш в памяти для часто запрашиваемых файлов
- Параллельная обработка тысяч соединений

Итог: style.css (40KB) через Nginx загружается за ~5ms, через Node.js — ~30-80ms.
