# Optimizer V2 Visual System

## Reference Images

- `design/concepts/character-desktop.png` — primary desktop setup composition
- `design/concepts/results-desktop.png` — dedicated Results hierarchy
- `design/concepts/character-mobile.png` — mobile stacking and touch behavior
- `client/public/assets/floating-castles-desktop.png` — desktop background asset
- `client/public/assets/floating-castles-mobile.png` — mobile background asset

The generated concepts implement the already-approved product design. Their sample item requirements and projected values are illustrative only; the application must render verified dynamic data instead.

## Creative Direction

An original floating-castle adventurer companion: dark iron and blue-slate surfaces, aged brass structure, parchment typography, and a single cool teal magical accent. The interface is immersive but edited. Decoration lives at the frame edges and in small compass/sword motifs so the task remains dominant.

No official anime art, logos, characters, guild marks, or copied interface elements are permitted.

## Color Lock

```css
--color-void: #090d11;
--color-ink: #111922;
--color-ink-deep: #0b1117;
--color-steel: #273847;
--color-brass: #b8955d;
--color-brass-bright: #d6b56e;
--color-parchment: #eee6d2;
--color-muted: #a9b2b8;
--color-aether: #55d6c2;
--color-aether-bright: #68f2e7;
--color-rune: #7aa7ff;
--color-danger: #ff7b72;
```

The background is dark blue-black, never true black or a warm brown. Teal appears only on the selected step, selected control, primary action, and important recommendation. Brass defines structure; it is not a fill color for large regions.

## Typography

- Product name and screen headings: `Cinzel`, Georgia, serif; weight 500–600; restrained tracking.
- UI controls and body: `Source Sans 3`, system-ui, sans-serif; deliberate 15–18 px control text.
- Numeric/stat tables: `Source Sans 3` with tabular numerals.
- Parchment is the primary text color; muted blue-gray is secondary copy.

## Container Model

- One quiet full-width app header.
- One progress rail immediately below the header.
- One centered primary frame, maximum width 1080–1120 px on desktop.
- Open ruled sections inside the frame; avoid nested card stacks.
- Weapon paths are the only necessary repeated selection tiles.
- Results use horizontal bands and rows, not loot-card grids.

## Core Components

- `AppHeader`: product name and one sign-in/sync action.
- `ProgressRail`: four steps with icon, label, connector, selected teal treatment, and `aria-current`.
- `OrnamentalFrame`: thin brass corners/rules with a dark readable center.
- `Field`, `SelectField`, `Disclosure`: 48–56 px controls with visible teal focus.
- `WeaponPathOption`: icon, path label, selected inset glow; 2 columns on mobile and 6 columns on wide desktop.
- `PrimaryButton`, `SecondaryButton`: angular/brass outline geometry; minimum 44 px target.
- `ResultBand`: open heading and ruled content.
- `UpgradeRow`: item, slot, requirement, acquisition, improvement, source link.

## Icon Inventory

- Product/progress: sword, starburst, shield, rune crystal.
- Weapon choices: greatsword, sword-and-shield, rapier, dagger pair, crossed swords, gauntlet/axe-like melee mark.
- Utility: user outline, chevron down, external-link arrow, back/forward chevrons.

Use clean code-native SVG with consistent 1.5–2 px brass strokes and `currentColor`. Icons are supportive and must not introduce extra navigation.

## Responsive Rules

- At 768 px and below, switch to the mobile background and a single primary surface.
- Preserve all four progress steps without horizontal scrolling; icons may shrink before labels disappear.
- Stack character fields; use two weapon tiles per row.
- Keep action targets at least 44 px and prevent sticky actions from covering the final control.
- Results upgrade rows become labeled vertical groups rather than horizontally scrolling tables.

## Motion

- 160–220 ms transitions for focus, selected edges, and route entrance.
- A small teal line draw or opacity change may indicate progress.
- No parallax, pulsing glow, or decorative motion.
- Under `prefers-reduced-motion`, remove nonessential transitions.

## Visible Copy Lock

Setup screens may show only the approved product and workflow copy: product name, sign-in action, Character/Stats/Equipment/Results steps, field labels, weapon-path names, goal names, Improve accuracy, Back, and Continue. Results may show the four approved hierarchy labels plus dynamic verified item and metric content.

Do not add hero copy, marketing claims, badges, fake metrics, dashboards, inventory navigation, boss navigation, or explanatory filler above the fold.
