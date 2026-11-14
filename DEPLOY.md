# Deploy

Статика живёт на том же сервере, что и релей: nginx отдаёт файлы и проксирует `/api/` на релей,
поэтому запросы с сайта — same-origin. Домена и TLS пока нет, сайт отвечает по адресу
`http://152.53.199.71:8321/`.

## Что где лежит на сервере

| путь | что это |
| --- | --- |
| `/var/www/slag-site/releases/<YYYYmmdd-HHmmss>/` | сборка целиком, неизменяемая |
| `/var/www/slag-site/current` | симлинк на активную сборку |
| `/etc/nginx/sites-available/slag-site` | конфиг сайта, включён симлинком в `sites-enabled` |

Пять последних сборок остаются на диске — этого хватает, чтобы откатиться без пересборки.

## Выкат

```powershell
pwsh scripts/deploy.ps1              # сборка + выкат + проверка
pwsh scripts/deploy.ps1 -SkipBuild   # выкатить уже собранное dist/
```

Скрипт собирает сайт, пакует `dist/` в tar, заливает в `/tmp`, распаковывает в новый каталог
`releases/<stamp>`, переключает симлинк `current` атомарно и проверяет страницу запросом.
Если запрос не 200 — в консоли ошибка и ненулевой код возврата.

## Откат

```bash
ssh netcup-server
ls /var/www/slag-site/releases
ln -sfn /var/www/slag-site/releases/<нужный> /var/www/slag-site/current
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8321/
```

## Когда появится домен

1. A-запись домена → `152.53.199.71` (и `www` тоже).
2. В `deploy/nginx-slag-site.conf` заменить `listen 8321` на `listen 443 ssl` и `server_name`.
3. `certbot --nginx -d <домен> -d www.<домен>` — сертификат и редирект с http.
4. Поменять `site` в `astro.config.mjs` и `SITE_URL` в приложении (`src/config/site.ts`).

До этого момента: http, по IP, без сертификата. Для платежей банк такой адрес не примет — это
временное состояние, а не релиз.
