#!/bin/bash
# Запуск ngrok туннеля для Telegram Mini App
# Использование: ./start-tunnel.sh
#
# Перед запуском убедитесь что docker-compose запущен:
#   docker-compose up -d --build
#
# После запуска скопируйте HTTPS URL из вывода ngrok
# и укажите его в @BotFather -> /newapp -> Web App URL

ngrok http 80
