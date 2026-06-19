# Styling: Famiry World Cup v1

Date: 2026-06-18

## Direction

Use a balanced, responsive sports-editorial style: strong hierarchy, crisp data surfaces, restrained tournament color, and compact information density. The interface should feel like a live competition dashboard rather than a marketing site.

## Foundations

Material UI is the component and styling system. Shared colors, typography, radii, spacing, and component overrides belong in `components/AppThemeProvider.tsx`; use local `sx` rules only for layout-specific behavior.

- Base spacing unit: `8px`
- Page background: `#f3f6fa`
- Primary text: `#172033`
- Primary blue: `#0b5cab`
- Divider: `#d8e0eb`
- Cards: white, `14px` radius, subtle divider border, no shadow
- Card content padding: `20px`

Blue communicates structure and selection. Green, red, and amber are reserved for match or system status.

## Layout Patterns

Use responsive page gutters and explicit gaps. Overview card rows use native CSS Grid so card edges align without Material UI's legacy `Grid spacing` item padding. Use MUI `Grid` where its responsive item behavior is useful, but account for its generated top and left padding.

Desktop layouts should show information side by side. Mobile layouts should stack controls and content while preserving readable touch targets. Tables and the knockout bracket may scroll horizontally inside their own bordered container; the page itself must never scroll horizontally.

The sticky header has three layers: brand, match ticker/status, and scrollable tabs. Keep divider colors consistent between these layers.

## Components and States

- Page sections share an eyebrow, title, description, and optional right-aligned control.
- Stat cards use equal heights, a blue icon tile, a prominent value, and muted label.
- Tables use stable minimum widths, aligned cells, and horizontal overflow containers.
- Chips are compact and bold. Live badges pulse slowly, but animations must stop under `prefers-reduced-motion`.
- Team labels keep flags and abbreviations on one line.
- Empty, stale, and error states use MUI alerts rather than custom banners.

## Accessibility

Preserve semantic headings, tabs, tables, labels, visible focus states, and sufficient contrast. Do not rely on color alone for status. New motion must include a reduced-motion fallback.
