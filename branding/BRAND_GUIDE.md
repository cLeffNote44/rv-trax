# RV Trax — Brand Guide

## Brand Identity: "Canyon Sage"

A warm, outdoor-professional palette that communicates trust, nature, and premium quality.
Designed for all-day dashboard use in bright office environments.

---

## Color Palette

### Core Colors

| Role             | Name          | Hex       | RGB           | Usage                            |
| ---------------- | ------------- | --------- | ------------- | -------------------------------- |
| Background       | Warm White    | `#FAF7F2` | 250, 247, 242 | Page backgrounds                 |
| Surface          | Soft Sand     | `#F5EFE6` | 245, 239, 230 | Cards, panels, elevated surfaces |
| Sidebar          | Warm Charcoal | `#2C2522` | 44, 37, 34    | Sidebar, dark sections           |
| Primary Accent   | Forest Sage   | `#4A7C59` | 74, 124, 89   | Buttons, links, active states    |
| Secondary Accent | Brand Gold    | `#C4943D` | 196, 148, 61  | Badges, highlights, logo accent  |
| Text Primary     | Deep Brown    | `#3D2B1F` | 61, 43, 31    | Headings, body text              |
| Text Secondary   | Mocha         | `#7A6A5A` | 122, 106, 90  | Labels, descriptions, muted text |
| Border           | Tan           | `#E0D5C4` | 224, 213, 196 | Card borders, dividers           |

### Semantic Colors

| Role    | Name        | Hex       | RGB          | Usage                         |
| ------- | ----------- | --------- | ------------ | ----------------------------- |
| Success | Forest Sage | `#4A7C59` | 74, 124, 89  | Online, healthy, completed    |
| Warning | Warm Amber  | `#D4A017` | 212, 160, 23 | Caution, pending, low battery |
| Error   | Terracotta  | `#C4523A` | 196, 82, 58  | Offline, critical, failed     |
| Info    | Slate Teal  | `#5B8A8A` | 91, 138, 138 | Information, tips, links      |

### Extended Palette

| Name             | Hex       | Usage                           |
| ---------------- | --------- | ------------------------------- |
| Sage Light       | `#E8F0EA` | Success backgrounds             |
| Sage Dark        | `#3A6347` | Hover state for primary buttons |
| Gold Light       | `#FDF5E6` | Badge backgrounds               |
| Gold Dark        | `#A07830` | Hover state for gold elements   |
| Terracotta Light | `#FDF0ED` | Error backgrounds               |
| Amber Light      | `#FEF9E7` | Warning backgrounds             |
| Charcoal Light   | `#3D3530` | Sidebar hover                   |
| Cream            | `#F9F3EB` | Alternate background            |

---

## Typography

| Role        | Font           | Weight | Size    |
| ----------- | -------------- | ------ | ------- |
| Headings    | Inter          | 700    | 24-32px |
| Subheadings | Inter          | 600    | 18-20px |
| Body        | Inter          | 400    | 14-16px |
| Labels/Caps | Inter          | 500    | 12-13px |
| Monospace   | JetBrains Mono | 400    | 13px    |

---

## Logo Usage

### Placement

- **Sidebar**: Icon only (40x40px) with "RV Trax" text beside it
- **Landing page**: Full logo with text
- **Favicon**: Icon only at 32x32
- **Login page**: Full logo centered above form

### Logo on Backgrounds

- On light backgrounds (`#FAF7F2`): Use dark version
- On dark backgrounds (`#2C2522`): Use light/inverse version
- Minimum clear space: Half the logo height on all sides

### Files Required

Place in `/branding/logo/`:

- `logo-full-dark.svg` — Full logo for light backgrounds
- `logo-full-light.svg` — Full logo for dark backgrounds
- `logo-icon-dark.svg` — Icon only for light backgrounds
- `logo-icon-light.svg` — Icon only for dark backgrounds
- `logo-full-dark.png` — 1200px wide, for marketing
- `logo-icon-dark.png` — 512px, for app icons

---

## Component Styling

### Buttons

- **Primary**: `bg-[#4A7C59]` text white, hover `bg-[#3A6347]`, rounded-lg
- **Secondary**: `bg-transparent` border `#E0D5C4`, text `#3D2B1F`, hover `bg-[#F5EFE6]`
- **Gold/CTA**: `bg-[#C4943D]` text white, hover `bg-[#A07830]` — use sparingly for premium CTAs
- **Destructive**: `bg-[#C4523A]` text white, hover darker

### Cards

- Background: `#FFFFFF` or `#F5EFE6`
- Border: `1px solid #E0D5C4`
- Border radius: 12px
- Shadow: `0 1px 3px rgba(61, 43, 31, 0.06)`

### Sidebar

- Background: `#2C2522`
- Text: `#D4C4A8` (muted), `#FAF7F2` (active)
- Active item: `bg-[#4A7C59]` with white text
- Hover: `bg-[#3D3530]`
- Logo area: Slightly lighter background

### Tables

- Header: `#F5EFE6` background, `#3D2B1F` text, font-weight 600
- Rows: White background, `#E0D5C4` border-bottom
- Hover: `#FAF7F2` background
- Alternating: Optional `#FDFBF8` for even rows

### Status Badges

- Success: `bg-[#E8F0EA] text-[#4A7C59]`
- Warning: `bg-[#FEF9E7] text-[#8B6914]`
- Error: `bg-[#FDF0ED] text-[#C4523A]`
- Info: `bg-[#EBF4F4] text-[#5B8A8A]`
- Neutral: `bg-[#F5EFE6] text-[#7A6A5A]`

---

## Dark Mode

For dark mode, invert the scale:

| Light Mode          | Dark Mode           |
| ------------------- | ------------------- |
| `#FAF7F2` (bg)      | `#1A1612` (bg)      |
| `#F5EFE6` (surface) | `#2C2522` (surface) |
| `#FFFFFF` (card)    | `#332C28` (card)    |
| `#3D2B1F` (text)    | `#E8D5B5` (text)    |
| `#7A6A5A` (muted)   | `#9A8876` (muted)   |
| `#E0D5C4` (border)  | `#4A3F35` (border)  |

Accent colors (sage, gold, semantic) stay the same in both modes.

---

## Do's and Don'ts

### Do

- Use Forest Sage as the dominant accent — it should be the color users associate with RV Trax
- Use Brand Gold sparingly for emphasis (pricing badges, featured items, premium CTAs)
- Maintain WCAG AA contrast ratios (4.5:1 for body text, 3:1 for large text)
- Use warm white backgrounds for the main content area

### Don't

- Don't use Sage and Gold side-by-side at equal weight — Sage leads, Gold accents
- Don't use pure black (`#000000`) — use Deep Brown (`#3D2B1F`) instead
- Don't use pure white (`#FFFFFF`) for page backgrounds — use Warm White (`#FAF7F2`)
- Don't mix cool grays (slate, zinc) with the warm palette
