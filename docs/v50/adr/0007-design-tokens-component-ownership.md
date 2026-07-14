# ADR-0007: дизайн-токены и ownership компонентов

- Статус: принято для v50
- Дата: 2026-07-12
- Зависимости: ADR-0003

## Контекст

Прототип v50 задаёт visual language, но копирование его CSS/DOM в Next.js и Flutter создаст две несвязанные реализации. Production уже имеет `app/globals.css` и Flutter `vethelp_ios_theme.dart`; нужен общий семантический contract без runtime-зависимости платформ друг от друга.

## Альтернативы

1. Копировать prototype CSS. Быстро, но не переносимо и не accessibility-safe.
2. Общий runtime component package для web/mobile. Непрактично из-за разных rendering/accessibility моделей.
3. Versioned semantic token spec + platform-native themes/components + visual contract tests.

## Решение

Выбран вариант 3. Общая спецификация называет semantic tokens, а не raw palette: surfaces, text, border, accent, success/warning/danger/info, spacing, radius, shadow, motion, z-index и typography roles. Light/dark/high-contrast значения принадлежат platform adapters.

Ownership:

- `docs/v51/design-tokens.json` в Этапе 2 — reviewable source contract;
- Next adapter — CSS custom properties/theme layer в clinic portal;
- Flutter adapter — immutable ThemeExtension/`vethelp_ios_theme.dart` integration;
- feature teams владеют compositions, но primitives (`Button`, `Field`, `Card`, status badge, dialog/sheet, loading/error/empty) принадлежат design-system layer;
- domain status mapping отделён от цвета: неизвестный статус отображается neutral и логируется.

Компоненты должны поддерживать keyboard/focus, screen reader semantics, 200% zoom/web reflow, text scaling, reduced motion, minimum touch targets и locale expansion. Прототип служит reference screenshot/semantics, а не production dependency.

## Последствия

- Положительные: единый язык с нативными реализациями; постепенная миграция; accessibility проверяется централизованно.
- Отрицательные: возможны небольшие platform-specific visual differences; изменение token требует coordinated review.

## Обратная совместимость

Существующие CSS classes и Flutter widgets мигрируют постепенно через adapters. Старые значения остаются aliases на deprecation window; feature pages не переписываются массово.

## Миграция

1. Этап 2 создаёт token schema, adapters и primitives без domain UI.
2. Добавить Storybook-equivalent/web fixture и Flutter golden/a11y fixtures.
3. Переводить shell, затем вертикальные slices; удалять aliases после coverage.

## Rollback

Platform adapter version можно откатить на предыдущие token values без изменения domain components. Новые components скрываются route/feature flags. Удалённые aliases возвращаются на один compatibility release; data/API rollback не требуется.
