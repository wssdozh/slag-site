// Runs on /status only. The relay answer is read from the same origin, so the page reports what
// this server actually sees — a third-party uptime widget would be a nicer lie.
const root = document.querySelector<HTMLElement>('[data-status]');
const title = document.querySelector<HTMLElement>('[data-status-title]');
const meta = document.querySelector<HTMLElement>('[data-status-meta]');

const clock = () =>
  new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

const span = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days} д ${hours} ч`;
  if (hours > 0) return `${hours} ч ${minutes} мин`;
  return `${minutes} мин`;
};

const paint = (state: 'ok' | 'down', heading: string, detail: string) => {
  if (root) root.dataset.state = state;
  if (title) title.textContent = heading;
  if (meta) meta.textContent = detail;
};

if (root && title && meta) {
  fetch('/health', { headers: { accept: 'application/json' } })
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
    .then((data: { version?: string; uptime?: number; status?: string }) => {
      const uptime = typeof data.uptime === 'number' ? ` · работает ${span(data.uptime)}` : '';
      const version = data.version ? `версия ${data.version}` : 'версия неизвестна';
      paint('ok', 'Отвечает', `${version}${uptime} · проверено в ${clock()}`);
    })
    .catch(() => {
      paint(
        'down',
        'Не отвечает',
        `сервер не вернул /health · проверено в ${clock()}. Синхронизация ждёт, локальные заметки на месте.`,
      );
    });
}

// `export {}` keeps this file a module: two landing scripts must not share top-level names when
// the type checker looks at them as plain scripts.
export {};
