# V50 semantic design-token mapping

## Decision

`docs/v50/design-tokens.json` is the only canonical cross-platform token contract. It is derived from the verified V50 prototype manifest, especially `styles/00-reset-tokens.css`, with the stable semantic groups already consumed by the Flutter and Portal adapters. The prototype remains evidence, not a runtime dependency.

## Adapter mapping

| Canonical group | Flutter adapter | Portal adapter |
|---|---|---|
| `color.surface`, `color.content`, `color.border` | `ColorScheme` and `VetHelpSurfaceTokens` | `--vh-bg`, `--vh-surface*`, `--vh-text`, `--vh-muted`, `--vh-border` |
| `color.accent`, `success`, `warning`, `danger`, `info` | `ColorScheme.primary/error` and semantic extension colours | `--vh-primary*`, `--vh-success`, `--vh-warning*`, `--vh-critical*` |
| `spacing`, `radius`, `shadow` | `VetHelpSurfaceTokens` layout fields | `--vh-space-*`, `--vh-radius-*`, `--vh-shadow-*` |
| `typography` | Material/Cupertino text themes | `--vh-type-*` and inherited application typography |
| `motion` | platform-native transitions with reduced-motion checks | transition variables and `prefers-reduced-motion` override |
| `layout` | bottom navigation below 768px, rail from 768px, framed navigation from 1121px | compact navigation below 768px, rail/tablet layout from 768px, full sidebar from 1121px |
| `a11y` | 44px targets and semantic navigation labels | 44px targets, 3px visible focus ring, skip link |

## Compatibility

`docs/v51/design-tokens.json` is a compatibility descriptor only. It identifies this canonical file and its content checksum; it must not contain a second token tree. Runtime adapters embed platform-native values and must be updated together with this contract. V51-named runtime selectors and flags remain aliases for one compatibility window.

## Source and change control

- Authoritative source: `prototype-v50/index.html`.
- Source manifest SHA-256: `245e092941dcd11f590423e9c8d54929fe7b6adfa2abcb6c2168fd56ba79ff42`.
- Unknown domain statuses use neutral presentation; colours never grant authority.
- A token change requires contract tests, both adapter tests, responsive evidence, and a rollback note.
