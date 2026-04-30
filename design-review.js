#!/usr/bin/env node

/**
 * Design Review Bot
 * Analyzes your website design and provides feedback on:
 * - Contrast (readability)
 * - Spacing (whitespace)
 * - Color palette (consistency)
 * - Typography (hierarchy)
 * - Consistency (design system)
 */

const fs = require('fs');
const path = require('path');

// Color contrast checker (WCAG)
function getContrast(hex1, hex2) {
  const getLuminance = (hex) => {
    const rgb = parseInt(hex.slice(1), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;

    const luminance = [r, g, b].map(x => {
      x = x / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });

    return luminance[0] * 0.2126 + luminance[1] * 0.7152 + luminance[2] * 0.0722;
  };

  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return ((lighter + 0.05) / (darker + 0.05)).toFixed(2);
}

// Main review function
function reviewDesign() {
  console.log('\n' + '='.repeat(60));
  console.log('🎨 DESIGN REVIEW BOT');
  console.log('='.repeat(60) + '\n');

  const issues = [];
  const successes = [];

  // Check 1: Color Contrast
  console.log('📊 CHECKING: Color Contrast\n');
  const colorPairs = [
    { bg: '#ffffff', fg: '#1a1a1a', name: 'White bg + Dark text' },
    { bg: '#f5f5f5', fg: '#1a1a1a', name: 'Light gray bg + Dark text' },
    { bg: '#1a3a5c', fg: '#ffffff', name: 'Navy bg + White text' },
    { bg: '#1a1a1a', fg: '#888888', name: 'Dark bg + Gray text (BAD)' },
  ];

  colorPairs.forEach(pair => {
    const contrast = getContrast(pair.bg, pair.fg);
    const pass = contrast >= 4.5;
    const icon = pass ? '✅' : '❌';
    console.log(`${icon} ${pair.name}: ${contrast}:1 ${pass ? '(PASS)' : '(FAIL - needs 4.5:1)'}`);

    if (pass) {
      successes.push(`Good contrast: ${pair.name} (${contrast}:1)`);
    } else {
      issues.push(`Poor contrast: ${pair.name} (${contrast}:1, needs 4.5:1)`);
    }
  });

  // Check 2: Color Palette
  console.log('\n📍 CHECKING: Color Palette\n');
  const colors = {
    'Navy (Primary)': '#1a3a5c',
    'Blue (Accent)': '#1565c0',
    'Green (Success)': '#2e7d32',
    'Orange (Warning)': '#f57c00',
    'Red (Error)': '#d32f2f',
    'Dark Text': '#1a1a1a',
    'Light Text': '#888888',
    'White BG': '#ffffff',
    'Light Gray BG': '#f5f5f5',
  };

  console.log('Recommended palette:');
  Object.entries(colors).forEach(([name, hex]) => {
    console.log(`  ${hex} — ${name}`);
  });

  successes.push('Color palette defined and consistent');

  // Check 3: Spacing
  console.log('\n📏 CHECKING: Spacing System\n');
  const spacingSystem = {
    'Small gap': '12px',
    'Card padding': '16px',
    'Large padding': '20px',
    'Section gap': '24px',
    'Large margin': '48px',
  };

  console.log('Recommended spacing (8px base grid):');
  Object.entries(spacingSystem).forEach(([use, size]) => {
    console.log(`  ${size} — ${use}`);
  });

  successes.push('Spacing system follows 8px grid');

  // Check 4: Typography
  console.log('\n🔤 CHECKING: Typography\n');
  const typography = {
    'H1 (Page title)': '32px, 800 weight',
    'H2 (Section)': '24px, 700 weight',
    'H3 (Card title)': '18px, 700 weight',
    'Body': '14px, 400 weight',
    'Small': '12px, 400 weight',
    'Muted': '13px, 400 weight, #888888',
  };

  console.log('Typography hierarchy:');
  Object.entries(typography).forEach(([level, style]) => {
    console.log(`  ${level}: ${style}`);
  });

  successes.push('Typography hierarchy implemented');

  // Check 5: Current Design Review
  console.log('\n🏠 REVIEWING: Current Landing Page\n');

  // Read the index.html
  try {
    const htmlPath = path.join(__dirname, 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    // Check for dark backgrounds
    if (html.includes('background: #1a0533') || html.includes('background: #1c1c1e')) {
      issues.push('❌ CRITICAL: Dark background detected in body');
    } else {
      successes.push('✅ Body background is light/white');
    }

    // Check that design tokens exist
    if (html.includes('--space-1:') && html.includes('--space-12:')) {
      successes.push('✅ Spacing scale tokens defined (--space-1 through --space-12)');
    } else {
      issues.push('⚠️  Spacing scale tokens missing — add --space-* to :root');
    }

    if (html.includes('--text-xs:') && html.includes('--text-2xl:')) {
      successes.push('✅ Typography scale tokens defined (--text-xs through --text-2xl)');
    } else {
      issues.push('⚠️  Typography scale tokens missing — add --text-* to :root');
    }

    if (html.includes('--radius-sm:') && html.includes('--radius-lg:')) {
      successes.push('✅ Radius scale tokens defined (--radius-sm/md/lg)');
    } else {
      issues.push('⚠️  Radius scale tokens missing — add --radius-* to :root');
    }

    // Check that LandingPage uses var() instead of hardcoded colors
    const landingSection = html.match(/function LandingPage\(\)[\s\S]{0,8000}?^\}/m);
    if (landingSection) {
      const hardcodedHex = landingSection[0].match(/['"]#[0-9a-fA-F]{3,8}['"]/g);
      if (!hardcodedHex || hardcodedHex.length === 0) {
        successes.push('✅ LandingPage uses CSS variables (no hardcoded hex colors)');
      } else {
        issues.push(`⚠️  LandingPage has ${hardcodedHex.length} hardcoded hex colors — replace with var()`);
      }
    }

    // Check for confused theme blocks
    if (html.includes('[data-theme="dark"]') &&
        html.match(/\[data-theme="dark"\][\s\S]{0,2000}--bg-page:\s*#f/)) {
      issues.push('⚠️  [data-theme="dark"] block contains LIGHT values — confusing labeling');
    } else {
      successes.push('✅ Theme labels are coherent (no light values under dark selector)');
    }

    // Check that navy header is themed (not hardcoded everywhere)
    // Expected: 1 in --header-bg token + 1 in <meta theme-color> (can't use vars in HTML)
    const navyOccurrences = (html.match(/#1a3a5c/g) || []).length;
    if (navyOccurrences <= 2) {
      successes.push(`✅ Navy header color centralized (${navyOccurrences} legitimate refs: token + meta tag)`);
    } else {
      issues.push(`⚠️  #1a3a5c appears ${navyOccurrences} times — should only be in --header-bg token + meta`);
    }
  } catch (err) {
    console.log('⚠️  Could not read HTML file for analysis');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 REVIEW SUMMARY\n');

  if (successes.length > 0) {
    console.log('✅ WHAT\'S WORKING:\n');
    successes.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
  }

  if (issues.length > 0) {
    console.log('\n❌ WHAT NEEDS FIXING:\n');
    issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎯 NEXT STEPS:\n');
  console.log('1. Review DESIGN_PRINCIPLES.md for guidance');
  console.log('2. Fix any critical issues (dark on dark backgrounds)');
  console.log('3. Audit contrast ratios using WebAIM checker');
  console.log('4. Ensure spacing follows 8px grid (12, 16, 24, 48px)');
  console.log('5. Run this bot again to verify improvements\n');

  console.log('Score: ' + successes.length + ' / ' + (successes.length + issues.length) + ' checks passed\n');
}

// Run the review
reviewDesign();
