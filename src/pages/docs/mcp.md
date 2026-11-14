---
layout: ../../layouts/Doc.astro
title: MCP-сервер
description: Как отдать заметки SLAG своим ИИ-клиентам через Model Context Protocol.
---

# MCP-сервер

SLAG умеет работать как MCP-сервер: внешний ИИ-клиент читает и меняет хранилище по стандартному
протоколу через stdio. Данные не уходят никуда, кроме вашей машины — клиент запускает процесс
локально.

## Что доступно клиенту

- `list_notes`, `get_note`, `search_notes` — чтение и поиск;
- `save_note`, `delete_note` — создание, обновление, перемещение в корзину;
- `list_tasks`, `toggle_task` — срезы задач и переключение статусов;
- `list_folders`, `create_folder`, `list_tags` — структура хранилища;
- `get_vault_stats` — сводка.

Плюс ресурсы `slag://folders`, `slag://tasks/pending`, `slag://tags`, `slag://vault/stats` и
промпты `triage_inbox`, `daily_plan`, `review_tasks`.

## Сборка

Сервер собирается из исходников и запускается Node.js:

```bash
npm run build:mcp   # артефакт: dist/mcp/index.js
```

## Подключение

Путь к хранилищу передаётся аргументом `--vault`, иначе берётся последнее открытое в приложении.

**Claude Code:**

```bash
claude mcp add slag -- node /путь/к/slag-v2/dist/mcp/index.js --vault /путь/к/хранилищу
```

**Cursor** — `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "slag": {
      "command": "node",
      "args": ["/путь/к/slag-v2/dist/mcp/index.js", "--vault", "/путь/к/хранилищу"]
    }
  }
}
```

**DeepSeek Harness** — профиль MCP-клиента:

```yaml
- insert:
    - id: mcp-slag
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: slag
        transport: stdio
        command: node
        args: ['/путь/к/slag-v2/dist/mcp/index.js', '--vault', '/путь/к/хранилищу']
```

## Что стоит помнить

- Сервер пишет в то же хранилище, что и приложение. Правки применяются как обычные изменения и
  синхронизируются на другие устройства.
- Текст заметки не является командой: сервер не исполняет то, что в нём написано, и не тянет
  внешние ссылки.
- Удаление — всегда перемещение в `.trash/`, как и в интерфейсе.
