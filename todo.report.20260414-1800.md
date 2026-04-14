# Звіт — бейджі статусу БД у ServerPanel (2026-04-14 18:00)

## Виконано

### 1. Додано CSS клас `badge-muted`
- Сірий фон і сірий текст для RESTORING/RECOVERING бейджів
- Файл: `src/renderer/styles.css`

### 2. Оновлено логіку бейджів у `renderCard`
- RESTORING / RECOVERING → сірий бейдж (`badge-muted`)
- OFFLINE / SUSPECT / EMERGENCY та інші помилки → червоний бейдж (`badge-danger`)
- AG синхронізація — вже була, синій бейдж (`badge-info`) з назвою AG та станом синхронізації
- Файл: `src/renderer/components/ServerPanel.tsx`

### 3. Перевірка
- Помилок компіляції немає

## Підсумок бейджів біля назви БД
| Стан | Бейдж | Колір |
|------|-------|-------|
| ONLINE | — | — |
| OFFLINE | `OFFLINE` | червоний |
| SUSPECT / EMERGENCY | стан | червоний |
| RESTORING | `RESTORING` | сірий |
| RECOVERING | `RECOVERING` | сірий |
| В AG | `AgName (SyncState)` | синій |
