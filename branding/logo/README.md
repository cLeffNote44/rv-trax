# Logo Files

Place the following logo files here:

## Required Files

| File                  | Format | Size        | Usage                                           |
| --------------------- | ------ | ----------- | ----------------------------------------------- |
| `logo-full-dark.svg`  | SVG    | Vector      | Full logo for light backgrounds                 |
| `logo-full-light.svg` | SVG    | Vector      | Full logo for dark backgrounds (sidebar, login) |
| `logo-icon-dark.svg`  | SVG    | Vector      | Icon only for light backgrounds                 |
| `logo-icon-light.svg` | SVG    | Vector      | Icon only for dark backgrounds                  |
| `logo-full-dark.png`  | PNG    | 1200px wide | Marketing, Open Graph                           |
| `logo-icon-dark.png`  | PNG    | 512x512     | App icons, PWA                                  |

## Color Guidelines

- The logo should use these Canyon Sage palette colors:
  - **Deep Brown** `#3D2B1F` — primary logo color on light backgrounds
  - **Forest Sage** `#4A7C59` — accent elements (GPS pin, highlights)
  - **Brand Gold** `#C4943D` — secondary accent
  - **Warm White** `#FAF7F2` — logo color on dark backgrounds

## After Adding Logos

Run the icon generation script to create all favicon/PWA sizes:

```bash
# From project root
node branding/generate-icons.js
```

This will generate:

- `apps/web/public/favicon.ico` (16x16, 32x32)
- `apps/web/public/apple-touch-icon.png` (180x180)
- `apps/web/public/icons/icon-192.png`
- `apps/web/public/icons/icon-512.png`
- `apps/web/public/icons/icon-maskable-192.png`
- `apps/web/public/icons/icon-maskable-512.png`
- `apps/web/public/icons/icon.svg` (copied from logo-icon-dark.svg)
