# 🎨 Web Design Principles for Cricket Analytics
**Learning Guide for Building Professional Dashboards**

---

## Core Design Principles

### 1. **Hierarchy** — Guide the eye
**What it means:** Most important content should be most prominent
- Largest, boldest headings for main topics
- Secondary info smaller and lighter
- Tertiary info even smaller or muted

**Example:**
```
H1: League Name (24px, bold, dark)
  └─ H2: Season (18px, bold)
       └─ P: Metadata (13px, light gray)
```

**Exercise:** Look at your landing page. What's the first thing you see? Is it what matters most?

---

### 2. **Contrast** — Make it readable
**What it means:** Text must stand out from background
- Dark text on light background (or vice versa)
- WCAG AA standard: 4.5:1 contrast ratio minimum
- Test: Can you read it from 3 feet away?

**DO:**
```
✅ Dark gray (#1a1a1a) on white (#ffffff)
✅ Navy (#1a3a5c) on light (#f5f5f5)
```

**DON'T:**
```
❌ Gray (#888888) on dark (#1c1c1e) — too dim
❌ Dark (#1a1a1a) on dark (#1a0533) — invisible
```

**Tool:** Use [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

---

### 3. **Whitespace** — Let it breathe
**What it means:** Empty space is your friend, not wasted space
- Padding inside cards: 16-20px
- Gaps between cards: 12-16px
- Margins around sections: 24-48px
- Line-height: 1.5+ for readability

**Bad:** Everything crammed together
```
┌─────────────────────┐
│Title│Subtitle│Data │  ← Hard to read
└─────────────────────┘
```

**Good:** Breathing room
```
┌─────────────────────┐
│ Title               │
│                     │
│ Subtitle            │
│ Data                │
│                     │
└─────────────────────┘
```

---

### 4. **Color** — Minimal palette
**What it means:** Use 3-5 colors, not 20
- 1 Primary (navy #1a3a5c)
- 1 Secondary (accent #1565c0)
- 1 Success (green #2e7d32)
- 1 Warning (orange #f57c00)
- 1 Error (red #d32f2f)

**Exercise:** Count colors on ESPNcricinfo. It's probably < 5 main colors.

---

### 5. **Typography** — Readable fonts
**What it means:** Use 1-2 sans-serif fonts, proper sizing
- Font: Inter, -apple-system, Segoe UI (system fonts load fast)
- Sizes: 12px (small) → 14px (body) → 16-18px (headers) → 24-32px (titles)
- Weights: 400 (regular), 600 (semi-bold), 700 (bold)
- Max line-width: 60-80 characters for body text

**Bad:**
```
Serif fonts for headers (looks old)
Mix of 3+ font families (looks messy)
Text too small or too large (hard to read)
```

**Good:**
```
Clean sans-serif
Consistent sizing
Plenty of whitespace
```

---

### 6. **Consistency** — Same rules everywhere
**What it means:** Apply the same design system across all pages
- Card styling matches everywhere
- Button styles consistent
- Color usage predictable
- Spacing follows a grid (8px, 16px, 24px, etc.)

**Exercise:** Look at your landing page and league pages. Do they feel like the same app?

---

## Design Anti-Patterns (What NOT to do)

### ❌ Dark Text on Dark Background
Problem: Invisible, unreadable
```
#1a1a1a text on #1c1c1e background = bad contrast
```

### ❌ Too Many Colors
Problem: Looks unprofessional, confusing
```
5 different blues + 3 purples + 2 oranges = chaos
```

### ❌ No Whitespace
Problem: Overwhelming, hard to scan
```
┌────────────────────┐
│Content│More│Data  │  ← crowded
└────────────────────┘
```

### ❌ Inconsistent Spacing
Problem: Looks broken, feels unpolished
```
Card 1: 10px padding
Card 2: 20px padding
Card 3: 5px padding  ← feels wrong
```

### ❌ Mixed Font Sizes
Problem: No hierarchy, hard to read
```
All text is 14px size
Nothing stands out
```

### ❌ Hover Effects That Distract
Problem: Jarring animations, poor UX
```
Huge color changes on hover
Text jumps around
Slow transitions
```

---

## Practical Design Workflow

### Step 1: Define the Grid
```
Spacing unit: 8px
So you use: 8, 16, 24, 32, 40, 48px
Padding: 16 or 20px
Gaps: 12 or 16px
Margins: 24 or 48px
```

### Step 2: Pick Your Colors
```
Primary: Navy #1a3a5c (headers, main actions)
Accent: Blue #1565c0 (highlights, interactive)
Success: Green #2e7d32 (badges, positive)
Warning: Orange #f57c00 (alerts, pending)
Error: Red #d32f2f (errors)
Text: Dark #1a1a1a (body), Light #888888 (muted)
Background: White #ffffff
```

### Step 3: Typography Scale
```
H1: 32px, 800 weight → Page titles
H2: 24px, 700 weight → Section titles
H3: 18px, 700 weight → Card titles
Body: 14px, 400 weight → Normal text
Small: 12px, 400 weight → Metadata
```

### Step 4: Component Checklist
- [ ] Padding consistent (16-20px inside cards)
- [ ] Gap between items consistent (12-16px)
- [ ] Contrast passes WCAG AA (4.5:1)
- [ ] Hover states subtle (not jarring)
- [ ] Text aligned left (not centered for readability)
- [ ] Line-height 1.5+ (breathing room)
- [ ] One font family (serif OR sans-serif, not mixed)

---

## Learning Resources

### Free Tools
- **Figma** (figmadesign.com) — Design in browser, free plan available
- **Coolors** (coolors.co) — Color palette generator
- **WebAIM Contrast Checker** — Test text contrast
- **Google Fonts** — Browse free fonts
- **Penpot** (penpot.app) — Open-source Figma alternative

### Design Inspiration
- **Dribbble** (dribbble.com) — See what good looks like
- **Behance** (behance.net) — Professional design projects
- **ESPNcricinfo** — Cricket site with clean design
- **CricViz** — Data-focused cricket design
- **Stripe.com** — Minimal, professional design

### Learn By Reading
- **Design 101** (Material Design: material.io/design)
- **Spacing in Design** — 8px grid system is industry standard
- **Color Theory** — Why certain colors work together
- **Typography 101** — Font pairing, sizing, hierarchy

### Practice
1. Pick 3 websites you like
2. Screenshot their design
3. Identify: colors used, spacing, typography hierarchy
4. Recreate similar layout (don't copy, learn the pattern)

---

## Checklist: Review Your Own Design

Before you ship any design, ask:

### Readability
- [ ] Can I read all text without squinting?
- [ ] Is there enough contrast (text vs background)?
- [ ] Is the font size 12px minimum (14px preferred)?

### Hierarchy
- [ ] What's the most important thing? Is it biggest/boldest?
- [ ] Can I scan this page in 3 seconds and understand it?
- [ ] Are headers clearly different from body text?

### Spacing
- [ ] Do elements have breathing room (not crammed)?
- [ ] Is padding inside cards consistent (16-20px)?
- [ ] Are gaps between cards consistent (12-16px)?

### Color
- [ ] Did I use < 5 main colors?
- [ ] Do colors have purpose (primary, accent, success, warning, error)?
- [ ] Does it look like one cohesive app?

### Consistency
- [ ] Do all cards look the same?
- [ ] Do all buttons look the same?
- [ ] Does the landing page feel like the same app as inner pages?

### Interaction
- [ ] Are hover effects subtle (not jarring)?
- [ ] Is it clear what's clickable?
- [ ] Do animations serve a purpose (not just decorative)?

---

## Next Steps

1. **Review your current design** — Use the checklist above
2. **Pick ONE principle to master** — Start with Contrast
3. **Apply it everywhere** — Fix dark text on dark backgrounds
4. **Get feedback** — Share with someone, ask for honest critique
5. **Iterate** — Small improvements compound over time

**Remember:** Good design is invisible. Users don't notice it, they just feel that it works.

---

## Your Design Challenge

Look at your current landing page. Rate yourself 1-5 on each principle:

- Hierarchy: ___ / 5
- Contrast: ___ / 5
- Whitespace: ___ / 5
- Color: ___ / 5
- Typography: ___ / 5
- Consistency: ___ / 5

**Goal:** Get all to 4+. Which one needs the most work?
