# Используем официальный образ NGINX
FROM nginx:latest

# Копируем файл конфигурации NGINX
COPY ./docker/nginx/default.conf /etc/nginx/conf.d/default.conf

# Открываем порты для HTTP и HTTPS
EXPOSE 80
EXPOSE 443
