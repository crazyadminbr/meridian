# 🚀 Деплой на VDS — forum.ylamanager.ru

Пошаговая инструкция от нуля до рабочего форума под HTTPS.

---

## Что понадобится на VDS

- Ubuntu 20.04 / 22.04 / 24.04 (Debian тоже подойдёт)
- Доступ по SSH (root или sudo-пользователь)
- DNS: запись **A** для `forum.ylamanager.ru` → IP вашего VDS
  (проверить: `ping forum.ylamanager.ru` — должен ответить ваш сервер)

---

## Шаг 1 — Подключиться к серверу

```bash
ssh root@IP_вашего_сервера
# или если уже создан пользователь:
ssh user@forum.ylamanager.ru
```

---

## Шаг 2 — Установить Node.js 22+

```bash
# Установка через официальный скрипт NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Проверка
node -v   # должно быть v22.x.x
npm -v    # 10.x.x
```

---

## Шаг 3 — Установить PM2 (менеджер процессов) и Nginx

```bash
# PM2 — держит Node.js-процесс живым, поднимает после перезагрузки сервера
npm install -g pm2

# Nginx — принимает запросы на 80/443, проксирует на Node.js (порт 5000)
apt install -y nginx

# Certbot — бесплатные SSL-сертификаты Let's Encrypt
apt install -y certbot python3-certbot-nginx
```

---

## Шаг 4 — Загрузить код с GitHub

### 4.1 Создать репозиторий на GitHub

1. Зайдите на [github.com](https://github.com) → кнопка **+** → New repository
2. Имя: `meridian-forum` (или любое)
3. Private (закрытый) — рекомендуется
4. Не добавляйте README и .gitignore (они уже есть в проекте)
5. Нажмите **Create repository**

### 4.2 Запушить проект с вашего компьютера

```bash
# На вашем КОМПЬЮТЕРЕ (не на сервере):
cd путь/к/папке/forum

git init
git add .
git commit -m "Initial commit — Кровавый Меридиан"
git remote add origin https://github.com/ВАШ_НИК/meridian-forum.git
git push -u origin main
```

### 4.3 Клонировать на сервер

```bash
# На СЕРВЕРЕ:
mkdir -p /var/www
cd /var/www
git clone https://github.com/ВАШ_НИК/meridian-forum.git meridian
cd meridian
```

> Если репозиторий **приватный** — GitHub попросит логин/пароль.
> Используйте **Personal Access Token** вместо пароля:
> GitHub → Settings → Developer settings → Personal access tokens → Generate new token (classic)
> Права: поставьте галочку `repo`. Токен вставляйте вместо пароля.

---

## Шаг 5 — Настроить переменные окружения

```bash
cd /var/www/meridian/server
cp .env.example .env
nano .env
```

Заполните файл (пример для Gmail):

```env
PORT=5000
JWT_SECRET=вставьте_сюда_длинную_случайную_строку_минимум_32_символа
CLIENT_URL=https://forum.ylamanager.ru

# Emails владельцев (Команда Проекта) — через запятую, без пробелов
OWNER_EMAILS=ваш@email.com

# Gmail SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=ваш@gmail.com
SMTP_PASS=ваш_пароль_приложения_16_символов
SMTP_FROM="Кровавый Меридиан <ваш@gmail.com>"
```

Как сгенерировать случайный JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Сохранить и выйти из nano: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## Шаг 6 — Установить зависимости и запустить через PM2

```bash
cd /var/www/meridian/server
npm install --omit=dev

cd /var/www/meridian

# Создать директорию для логов
mkdir -p /var/log/meridian

# Запустить через PM2
pm2 start ecosystem.config.js

# Проверить статус
pm2 status

# Настроить автозапуск PM2 при перезагрузке сервера
pm2 startup
# Скопируйте и выполните команду, которую выведет pm2 startup, например:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root

pm2 save
```

Проверить что форум поднялся:
```bash
curl http://127.0.0.1:5000/api/health
# Должно вернуть: {"status":"ok","name":"Кровавый Меридиан API"}
```

---

## Шаг 7 — Настроить Nginx

```bash
# Копируем конфиг
cp /var/www/meridian/nginx.conf /etc/nginx/sites-available/forum.ylamanager.ru

# Активируем сайт
ln -s /etc/nginx/sites-available/forum.ylamanager.ru \
      /etc/nginx/sites-enabled/forum.ylamanager.ru

# Удаляем дефолтный сайт nginx (если мешает)
rm -f /etc/nginx/sites-enabled/default

# Проверяем конфигурацию
nginx -t

# Перезагружаем Nginx
systemctl reload nginx
```

Проверяем что сайт открывается по HTTP (без SSL):
```
http://forum.ylamanager.ru
```

---

## Шаг 8 — SSL-сертификат (HTTPS)

```bash
# Выпускаем бесплатный сертификат Let's Encrypt
certbot --nginx -d forum.ylamanager.ru

# Certbot задаст несколько вопросов:
#   Email: введите ваш email (для уведомлений об истечении)
#   Agree to terms: A
#   Share email with EFF: по желанию (N)
# Certbot сам отредактирует nginx.conf и добавит SSL

# Проверяем автообновление сертификата (раз в 90 дней)
certbot renew --dry-run
```

Теперь форум доступен по HTTPS:
```
https://forum.ylamanager.ru
```

---

## Шаг 9 — Обновить CLIENT_URL в .env

```bash
nano /var/www/meridian/server/.env
# Измените:
# CLIENT_URL=https://forum.ylamanager.ru

# Перезапустите сервер чтобы подхватил новый URL для ссылок в письмах
pm2 restart meridian
```

---

## Обновление форума в будущем

Когда внесли изменения на компьютере и запушили на GitHub:

```bash
# На сервере — один файл делает всё
cd /var/www/meridian
./deploy.sh
```

Или вручную:
```bash
cd /var/www/meridian
git pull origin main
cd server && npm install --omit=dev
cd ..
pm2 reload ecosystem.config.js
```

---

## Полезные команды

```bash
# Логи в реальном времени
pm2 logs meridian

# Последние 100 строк логов
pm2 logs meridian --lines 100

# Перезапуск форума
pm2 restart meridian

# Статус всех процессов
pm2 status

# Перезагрузить Nginx после изменения конфига
systemctl reload nginx

# Проверить конфиг Nginx на ошибки
nginx -t

# Статус Nginx
systemctl status nginx

# Посмотреть занятые порты
ss -tlnp | grep -E ':80|:443|:5000'
```

---

## Решение частых проблем

**Форум не открывается по IP:**
```bash
pm2 status          # проверить что процесс running
pm2 logs meridian   # смотреть ошибки
curl http://127.0.0.1:5000/api/health
```

**Nginx выдаёт 502 Bad Gateway:**
```bash
# Значит Node.js не запущен или упал
pm2 start ecosystem.config.js
pm2 logs meridian
```

**Certbot не может получить сертификат:**
```bash
# Убедитесь что DNS уже указывает на ваш IP
ping forum.ylamanager.ru
# И что порт 80 открыт (не заблокирован файрволом)
ufw allow 80
ufw allow 443
ufw allow 22
ufw enable
```

**Git просит пароль при pull:**
```bash
# Настройте хранение токена
git config credential.helper store
git pull origin main
# Введите логин и Personal Access Token один раз — сохранится
```

**Сервер не запускается (ошибка порта):**
```bash
# Проверить кто занимает порт 5000
ss -tlnp | grep 5000
# Убить лишний процесс
kill -9 PID
```

---

## Структура файлов на сервере

```
/var/www/meridian/          ← весь проект из GitHub
  server/
    .env                    ← секреты (НЕ в git!)
    database/forum.db       ← база данных (НЕ в git!)
    uploads/avatars/        ← загруженные аватары (НЕ в git!)
  client/                   ← статичные HTML/CSS/JS
  ecosystem.config.js       ← конфиг PM2
  deploy.sh                 ← скрипт быстрого обновления

/etc/nginx/sites-available/forum.ylamanager.ru   ← конфиг Nginx
/etc/letsencrypt/live/forum.ylamanager.ru/       ← SSL-сертификаты
/var/log/meridian/out.log                        ← логи форума
/var/log/meridian/err.log                        ← логи ошибок
```
