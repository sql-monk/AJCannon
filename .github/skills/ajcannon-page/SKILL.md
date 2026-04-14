---
name: ajcannon-page
description: 'Створення нових сторінок/панелей в AJCannon Electron-застосунку. USE FOR: додавання нового view/tab/panel, створення SQL-запитів для нового розділу, підключення IPC-каналу, додавання пункту в ObjectExplorer. DO NOT USE FOR: загальний рефакторинг, зміна існуючих панелей, стилі без нової сторінки.'
argument-hint: 'Опишіть що має показувати нова сторінка та які дані з SQL Server їй потрібні'
---

# Створення нової сторінки в AJCannon

## Коли використовувати

- Додавання нового view/tab у правій панелі застосунку
- Створення нового розділу з SQL-даними (таблиці, графіки, метрики)
- Підключення нового SQL-запиту до UI через повний ланцюг IPC

## Архітектура застосунку

```
Electron main process          │  Electron renderer (React)
───────────────────────────────┼──────────────────────────────
sql/queries/*.sql              │  App.tsx (роутинг по ctx.view)
sql/queries.ts (loadSql+exec)  │  components/*Panel.tsx
ipc-handlers.ts (ipcMain)      │  bridge.ts (window.sqlBridge)
preload.ts (contextBridge)     │  ObjectExplorer.tsx (дерево)
shared/types.ts ← спільні типи та IpcChannels →
```

### Потік даних

```
Клік у дереві ObjectExplorer
  → onContextChange({ server, view: "my-view" })
  → App.tsx: ctx.view === "my-view" → <MyPanel />
  → MyPanel: bridge.getMyData(server)
  → ipcRenderer.invoke("sql:get-my-data", server)
  → ipcMain.handle → Q.getMyData(server)
  → queryServer(server, loadSql("my-query"))
  → SQL Server → recordset → Promise<T[]> → setState → render
```

## Ключовий принцип: асинхронне завантаження панелей

Кожна `CollapsiblePanel` на сторінці **повинна завантажувати дані незалежно й асинхронно**:

- Кожна секція має власний `[data, loading, error]` стан та окрему `loadData` функцію
- Панелі НЕ чекають одна на одну — всі запити йдуть паралельно при відкритті сторінки
- `CollapsiblePanel` автоматично викликає `loadData` на mount (якщо не згорнута)
- Згорнуті панелі НЕ завантажують дані до розгортання — це економить запити
- Глобальна кнопка "Refresh" викликає `.refresh()` на кожному ref окремо (теж паралельно)

```typescript
// ✅ Правильно — кожна панель незалежна
const loadCpu = useCallback(async () => { setCpuData(await bridge.getCpu(server)); }, [server]);
const loadRam = useCallback(async () => { setRamData(await bridge.getRam(server)); }, [server]);

// Refresh all — кожна панель сама вирішує чи завантажувати (якщо не collapsed)
const refreshAll = () => {
  cpuRef.current?.refresh();
  ramRef.current?.refresh();
  dbRef.current?.refresh();
};
```

```typescript
// ❌ Неправильно — один великий запит блокує всю сторінку
const loadAll = async () => {
  const [cpu, ram, dbs] = await Promise.all([...]);
  setCpuData(cpu); setRamData(ram); setDbData(dbs);
};
```

## Процедура створення (9 кроків)

### Крок 1 — Типи даних (`src/shared/types.ts`)

Додати інтерфейс для результатів SQL-запиту:

```typescript
export interface MyNewData {
  columnName: number;
  anotherColumn: string;
}
```

Додати нове значення до типу `TreeView`:

```typescript
export type TreeView = "overview" | "activity" | ... | "my-new-view";
```

Додати IPC-канал до об'єкта `IpcChannels`:

```typescript
export const IpcChannels = {
  // ... існуючі
  GET_MY_NEW_DATA: "sql:get-my-new-data",
} as const;
```

### Крок 2 — SQL-запит (`src/main/sql/queries/my-new-query.sql`)

Формат файлу — перший рядок: теги через кому, потім блок `/* */` з описом колонок, потім SQL:

```sql
--my-new-view,tag2
/*
columnName     INT
anotherColumn  NVARCHAR(128)
*/
SELECT
    column_name   AS columnName,
    another_column AS anotherColumn
FROM sys.some_dmv WITH (NOLOCK)
ORDER BY column_name;
```

**Конвенції SQL файлів:**
- Перший рядок `--теги` — використовуються для фільтрації в Query Browser
- Блок `/* */` — metadata колонок (ім'я + тип), парсер використовує це
- camelCase аліаси в SELECT щоб збігалися з TypeScript інтерфейсом
- `WITH (NOLOCK)` на DMV
- Файл зберігається в `src/main/sql/queries/`

### Крок 3 — Функція запиту (`src/main/sql/queries.ts`)

```typescript
export async function getMyNewData(server: string): Promise<MyNewData[]> {
  const result = await queryServer<MyNewData>(server, loadSql("my-new-query"));
  return result.recordset;
}
```

**Варіанти виклику:**
- `queryServer<T>(server, sql)` — запит до master
- `queryDb<T>(server, database, sql)` — запит до конкретної бази
- Параметри в SQL — через `sql.replace("{{param}}", escapeSqlString(value))`

### Крок 4 — IPC-обробник (`src/main/ipc-handlers.ts`)

```typescript
ipcMain.handle(IpcChannels.GET_MY_NEW_DATA, async (_e, server: string) => {
  return Q.getMyNewData(server);
});
```

### Крок 5 — Preload bridge (`src/main/preload.ts`)

Додати метод в об'єкт `contextBridge.exposeInMainWorld("sqlBridge", { ... })`:

```typescript
getMyNewData: (server: string) => ipcRenderer.invoke(IpcChannels.GET_MY_NEW_DATA, server),
```

### Крок 6 — Renderer bridge (`src/renderer/bridge.ts`)

Додати метод до інтерфейсу `SqlBridge`:

```typescript
getMyNewData: (server: string) => Promise<MyNewData[]>;
```

### Крок 7 — React-компонент (`src/renderer/components/MyNewPanel.tsx`)

Приклад сторінки з двома незалежними асинхронними панелями:

```typescript
import { useState, useCallback, useRef } from "react";
import { bridge } from "../bridge";
import { CollapsiblePanel, CollapsiblePanelRef } from "./CollapsiblePanel";
import type { MyNewData, AnotherData } from "../../shared/types";

interface Props {
  server: string;
  onShowSql?: (tags: string[]) => void;
}

export function MyNewPanel({ server, onShowSql }: Props) {
  // --- Секція 1: My Data (незалежне завантаження) ---
  const section1Ref = useRef<CollapsiblePanelRef>(null);
  const [data1, setData1] = useState<MyNewData[]>([]);
  const [loading1, setLoading1] = useState(false);
  const [error1, setError1] = useState("");

  const loadData1 = useCallback(async () => {
    setLoading1(true);
    setError1("");
    try {
      setData1(await bridge.getMyNewData(server));
    } catch (e: unknown) {
      setError1(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading1(false);
    }
  }, [server]);

  // --- Секція 2: Another Data (незалежне завантаження) ---
  const section2Ref = useRef<CollapsiblePanelRef>(null);
  const [data2, setData2] = useState<AnotherData[]>([]);
  const [loading2, setLoading2] = useState(false);
  const [error2, setError2] = useState("");

  const loadData2 = useCallback(async () => {
    setLoading2(true);
    setError2("");
    try {
      setData2(await bridge.getAnotherData(server));
    } catch (e: unknown) {
      setError2(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading2(false);
    }
  }, [server]);

  // --- Глобальний refresh — кожна панель завантажується незалежно ---
  const refreshAll = () => {
    section1Ref.current?.refresh();
    section2Ref.current?.refresh();
  };

  return (
    <div className="page-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h3>My New View — {server}</h3>
        <button onClick={refreshAll}>Refresh</button>
      </div>

      <CollapsiblePanel
        ref={section1Ref}
        storageKey={`mynew:data1:${server}`}
        title="My Data"
        sqlTags={["my-new-view"]}
        onShowSql={onShowSql}
        loadData={loadData1}
        loading={loading1}
        error={error1}
      >
        <table className="result-grid">
          <thead><tr><th>Column</th><th>Another</th></tr></thead>
          <tbody>
            {data1.map((d, i) => (
              <tr key={i}><td>{d.columnName}</td><td>{d.anotherColumn}</td></tr>
            ))}
          </tbody>
        </table>
      </CollapsiblePanel>

      <CollapsiblePanel
        ref={section2Ref}
        storageKey={`mynew:data2:${server}`}
        title="Another Section"
        sqlTags={["my-new-view", "another-tag"]}
        onShowSql={onShowSql}
        loadData={loadData2}
        loading={loading2}
        error={error2}
      >
        {/* друга таблиця або інший UI */}
      </CollapsiblePanel>
    </div>
  );
}
```

**Патерни компонентів:**
- `CollapsiblePanel` — основний контейнер для секцій з даними
  - `storageKey` — унікальний ключ для збереження стану згортання в localStorage
  - `sqlTags` — теги що відповідають першому рядку .sql файлу
  - `loadData` — async функція завантаження (викликається автоматично на mount)
  - `ref` → `CollapsiblePanelRef` → дозволяє батьківському компоненту викликати `refresh()`
- **Кожна секція — окремий стан** `[data, loading, error]` + окремий `loadData` callback
- Таблиці — клас `result-grid` (sticky header, border-collapse)
- Числові комірки — клас `num` (text-align right, tabular-nums)
- Помилки — клас `error-msg`
- Завантаження — клас `loading`
- Сортування — `onClick` на `<th className="sortable">`, стан `[sortCol, sortDir]`
- Фільтр — `<input>` зверху з `data.filter(...)` в render
- Danger-рядки — клас `row-blocked` (червоний фон)

### Крок 8 — Роутинг в App.tsx (`src/renderer/App.tsx`)

Додати імпорт:

```typescript
import { MyNewPanel } from "./components/MyNewPanel";
```

Додати case в switch по `ctx.view`:

```typescript
case "my-new-view":
  return <MyNewPanel server={ctx.server} onShowSql={openQueriesModal} />;
```

### Крок 9 — Пункт в дереві ObjectExplorer (`src/renderer/components/ObjectExplorer.tsx`)

Додати вузол (leaf) всередині серверного вузла, поруч з існуючими:

```typescript
<IconLeaf
  icon={ICO.folder}
  label="My New View"
  onClick={() => onContextChange({ server, view: "my-new-view" })}
/>
```

## CSS-класи для використання

| Клас | Призначення |
|------|-------------|
| `.page-panel` | Обгортка сторінки |
| `.result-grid` | Таблиця з даними (sticky header) |
| `.result-grid .num` | Числова комірка (right-align) |
| `.cpanel` | CollapsiblePanel контейнер |
| `.error-msg` | Повідомлення про помилку |
| `.loading` | Індикатор завантаження |
| `.btn-sm` | Маленька кнопка (11px) |
| `.sortable` | Клікабельний заголовок стовпця |
| `.chip` / `.chip.active` | Фільтр-кнопка |
| `.row-blocked` | Рядок з danger-фоном |
| `.row-running` | Рядок з accent-фоном |
| `.modal-overlay` + `.modal` | Модальне вікно |
| `.dashboard-metric` | Метрика-картка (value + label) |
| `.activity-section` | Секція з фоном панелі |
| `.detail-code` | Блок коду (monospace, scroll) |

## CSS-змінні теми

```css
--bg: #1e1e1e          --accent: #0e639c
--bg-panel: #252526    --accent-hover: #1177bb
--bg-input: #3c3c3c   --border: #3c3c3c
--fg: #cccccc          --danger: #f44747
--fg-dim: #888888      --success: #89d185
```

## Чекліст перед завершенням

- [ ] Інтерфейс даних додано в `types.ts`
- [ ] `TreeView` розширено новим значенням
- [ ] `IpcChannels` містить новий канал
- [ ] `.sql` файл створено з тегами та metadata
- [ ] Функція в `queries.ts` повертає типізований результат
- [ ] `ipc-handlers.ts` має handler для нового каналу
- [ ] `preload.ts` має метод в `exposeInMainWorld`
- [ ] `bridge.ts` має метод в інтерфейсі `SqlBridge`
- [ ] React-компонент: кожна панель має окремий `[data, loading, error]` стан
- [ ] React-компонент: панелі завантажуються асинхронно та незалежно одна від одної
- [ ] `App.tsx` має case для нового view
- [ ] `ObjectExplorer.tsx` має leaf-вузол для навігації
- [ ] Компілюється без помилок (`npm run build`)
