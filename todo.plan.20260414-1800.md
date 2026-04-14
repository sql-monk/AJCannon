# План — бейджі статусу БД у ServerPanel (2026-04-14 18:00)

## Що потрібно
Додати до назви бази в списку ServerPanel:
1. Бейдж зі статусом AG (синхронізація) — **вже є** (`badge-info`)
2. Бейдж RESTORING/RECOVERING — зараз показується з `badge-danger` (червоний), потрібно змінити на сірий/нейтральний бейдж
3. Бейдж OFFLINE, SUSPECT, EMERGENCY — залишити червоним (`badge-danger`)

## Кроки
1. Додати CSS клас `badge-muted` для сірих бейджів (RESTORING, RECOVERING)
2. Змінити логіку вибору класу бейджа в `renderCard` — RESTORING/RECOVERING → `badge-muted`, решта не-ONLINE → `badge-danger`
3. Перевірити відсутність помилок
