# Plan — serverPanel databases section (2026-04-14)

## Context
Most of the work was already done in a previous session:
- Color helpers (`dbIconColor`, `dbNameColor`) ✅
- System DB grouping with collapsible header ✅
- Color rules for icon and name ✅
- CSS for `.db-icon`, `.db-system-group`, `.db-system-header` ✅

## Remaining task
The icon currently uses `⬤` (circle character). The TODO explicitly says "не кружечок а саме іконку бази" — replace with an SVG database icon.

### Steps
1. Replace `⬤` circle character with an inline SVG database icon in `DbCardList.renderCard` (ServerPanel.tsx)
2. Update `.db-icon` CSS to properly size the SVG
3. Verify no compile errors
