/*
 * Shared settings schema + CSS generator.
 *
 * Loaded as a plain script in both the popup and the content script, so
 * everything hangs off a single global: `ClaudeSkin`.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'settings';

  var DEFAULTS = {
    enabled: true,

    // ---- background -------------------------------------------------
    bgMode: 'none', // none | color | gradient | image
    bgColor: '#1b1a19',
    gradientFrom: '#20143a',
    gradientTo: '#0b1a2b',
    gradientAngle: 160,
    bgImage: '', // http(s) URL or data: URI
    bgImageSize: 'cover', // cover | contain | auto | 100% 100%
    bgImageBlur: 0, // px
    bgImageDim: 0, // 0-100 (%)
    surfaceOpacity: 100, // 0-100, how opaque the chat panels sit on the background
    surfaceColor: '', // '' = derive from bgColor / keep site colour

    // ---- text -------------------------------------------------------
    fontFamily: '', // '' = leave the site font alone
    customFontFamily: '',
    forceFontEverywhere: true,
    fontScale: 100, // 75-160 (%)
    lineHeight: 0, // 0 = untouched, otherwise unitless multiplier
    letterSpacing: 0, // px (can be negative)
    fontWeight: 0, // 0 = untouched, else 300-700
    textColor: '',
    accentColor: '',

    // ---- code -------------------------------------------------------
    codeFontFamily: '',
    customCodeFontFamily: '',
    codeFontSize: 0, // px, 0 = untouched

    // ---- layout -----------------------------------------------------
    chatWidth: 0, // px, 0 = untouched
    turnGap: 0, // px gap between chat turns, 0 = untouched
    hideSidebar: false,

    // ---- escape hatch ----------------------------------------------
    customCss: ''
  };

  // Fonts that ship with, or are commonly present on, desktop systems —
  // claude.ai's CSP blocks loading webfonts from third-party hosts, so we
  // only offer families the browser can already resolve locally.
  var FONT_STACKS = [
    { label: 'Site default', value: '' },
    { label: 'System UI', value: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
    { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
    { label: 'Helvetica / Arial', value: 'Helvetica, Arial, sans-serif' },
    { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
    { label: 'Trebuchet MS', value: '"Trebuchet MS", Tahoma, sans-serif' },
    { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
    { label: 'Palatino', value: '"Palatino Linotype", Palatino, Georgia, serif' },
    { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
    { label: 'Optima', value: 'Optima, Candara, "Segoe UI", sans-serif' },
    { label: 'Comic Sans MS', value: '"Comic Sans MS", "Comic Sans", cursive' },
    { label: 'Monospace', value: 'ui-monospace, Menlo, Consolas, "Courier New", monospace' },
    { label: 'Custom…', value: 'custom' }
  ];

  var CODE_FONT_STACKS = [
    { label: 'Site default', value: '' },
    { label: 'System mono', value: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
    { label: 'JetBrains Mono', value: '"JetBrains Mono", ui-monospace, monospace' },
    { label: 'Fira Code', value: '"Fira Code", ui-monospace, monospace' },
    { label: 'Cascadia Code', value: '"Cascadia Code", Consolas, monospace' },
    { label: 'Consolas', value: 'Consolas, "Courier New", monospace' },
    { label: 'Menlo', value: 'Menlo, Monaco, monospace' },
    { label: 'Courier New', value: '"Courier New", Courier, monospace' },
    { label: 'Custom…', value: 'custom' }
  ];

  var PRESETS = {
    midnight: {
      label: 'Midnight',
      settings: {
        bgMode: 'gradient',
        gradientFrom: '#0f1226',
        gradientTo: '#05070f',
        gradientAngle: 165,
        surfaceOpacity: 72,
        surfaceColor: '#141a2e',
        textColor: '#e6e8f2',
        accentColor: '#8b8cf5',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
      }
    },
    paper: {
      label: 'Paper',
      settings: {
        bgMode: 'color',
        bgColor: '#f4efe4',
        surfaceOpacity: 100,
        surfaceColor: '#fbf8f1',
        textColor: '#2b2724',
        accentColor: '#a8562a',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontScale: 105,
        lineHeight: 1.7,
        chatWidth: 720
      }
    },
    terminal: {
      label: 'Terminal',
      settings: {
        bgMode: 'color',
        bgColor: '#07100c',
        surfaceOpacity: 88,
        surfaceColor: '#0b1a12',
        textColor: '#b8f2c9',
        accentColor: '#3ddc84',
        fontFamily: 'ui-monospace, Menlo, Consolas, "Courier New", monospace',
        codeFontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        letterSpacing: 0.2
      }
    },
    solarized: {
      label: 'Solarized',
      settings: {
        bgMode: 'color',
        bgColor: '#002b36',
        surfaceOpacity: 94,
        surfaceColor: '#073642',
        textColor: '#eee8d5',
        accentColor: '#268bd2',
        fontFamily: 'Inter, system-ui, sans-serif'
      }
    },
    focus: {
      label: 'Focus',
      settings: {
        bgMode: 'none',
        hideSidebar: true,
        chatWidth: 860,
        fontScale: 108,
        lineHeight: 1.75
      }
    }
  };

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function withDefaults(stored) {
    var out = clone(DEFAULTS);
    if (!stored) return out;
    Object.keys(DEFAULTS).forEach(function (key) {
      if (stored[key] !== undefined && stored[key] !== null) out[key] = stored[key];
    });
    return out;
  }

  function applyPreset(current, presetName) {
    var preset = PRESETS[presetName];
    if (!preset) return current;
    var next = withDefaults(current);
    Object.keys(preset.settings).forEach(function (key) {
      next[key] = preset.settings[key];
    });
    return next;
  }

  function resolvedFont(settings) {
    if (settings.fontFamily === 'custom') return settings.customFontFamily.trim();
    return (settings.fontFamily || '').trim();
  }

  function resolvedCodeFont(settings) {
    if (settings.codeFontFamily === 'custom') return settings.customCodeFontFamily.trim();
    return (settings.codeFontFamily || '').trim();
  }

  function clamp(value, min, max, fallback) {
    var n = parseFloat(value);
    if (isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  /** Turn `#rrggbb` (or any CSS colour) into an rgba() string at `alpha`. */
  function withAlpha(color, alpha) {
    var a = clamp(alpha, 0, 1, 1);
    var hex = String(color || '').trim();
    var match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
    if (match) {
      var digits = match[1];
      if (digits.length === 3) {
        digits = digits[0] + digits[0] + digits[1] + digits[1] + digits[2] + digits[2];
      }
      var r = parseInt(digits.slice(0, 2), 16);
      var g = parseInt(digits.slice(2, 4), 16);
      var b = parseInt(digits.slice(4, 6), 16);
      return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')';
    }
    // Not a plain hex value — let the browser mix it instead.
    return 'color-mix(in srgb, ' + hex + ' ' + Math.round(a * 100) + '%, transparent)';
  }

  /** Nudge a hex colour lighter (amount > 0) or darker (amount < 0). */
  function shift(color, amount) {
    var match = /^#([0-9a-f]{6})$/i.exec(String(color || '').trim());
    if (!match) return color;
    var num = parseInt(match[1], 16);
    var parts = [(num >> 16) & 255, (num >> 8) & 255, num & 255].map(function (channel) {
      var next = channel + Math.round(255 * amount);
      return Math.min(255, Math.max(0, next));
    });
    return (
      '#' +
      parts
        .map(function (channel) {
          return ('0' + channel.toString(16)).slice(-2);
        })
        .join('')
    );
  }

  /** True when a colour reads as light, used to pick sensible companions. */
  function isLight(color) {
    var match = /^#([0-9a-f]{6})$/i.exec(String(color || '').trim());
    if (!match) return false;
    var num = parseInt(match[1], 16);
    var r = (num >> 16) & 255;
    var g = (num >> 8) & 255;
    var b = num & 255;
    return (r * 299 + g * 587 + b * 114) / 1000 > 140;
  }

  function backgroundLayerCss(settings) {
    if (settings.bgMode === 'color') {
      return settings.bgColor;
    }
    if (settings.bgMode === 'gradient') {
      var angle = clamp(settings.gradientAngle, 0, 360, 160);
      return (
        'linear-gradient(' + angle + 'deg, ' + settings.gradientFrom + ', ' + settings.gradientTo + ')'
      );
    }
    return '';
  }

  /**
   * Build the stylesheet injected into claude.ai.
   *
   * The site is Tailwind-based with its palette and fonts exposed as CSS
   * custom properties (--bg-000, --text-100, --font-sans, …), so the primary
   * strategy is to redefine those tokens. Blanket `!important` rules follow as
   * a safety net for anything that hardcodes a value.
   */
  function buildCss(raw) {
    var s = withDefaults(raw);
    if (!s.enabled) return '';

    var out = [];
    var rootVars = [];
    var bodyRules = [];

    var font = resolvedFont(s);
    var codeFont = resolvedCodeFont(s);
    var hasBg = s.bgMode !== 'none';
    var bgLayer = backgroundLayerCss(s);
    var usesImage = s.bgMode === 'image' && !!s.bgImage.trim();

    // ---- surfaces ----------------------------------------------------
    // When a custom background is in play, the site's own panels have to
    // become (semi-)transparent or they'd simply cover it up.
    if (hasBg || s.surfaceColor) {
      var base = s.surfaceColor || (s.bgMode === 'color' ? s.bgColor : s.gradientFrom) || '#1b1a19';
      var alpha = clamp(s.surfaceOpacity, 0, 100, 100) / 100;
      var light = isLight(base);
      var step = light ? -0.035 : 0.045;

      // claude.ai's background ramp, darkest/plainest first.
      ['--bg-000', '--bg-100', '--bg-200', '--bg-300', '--bg-400', '--bg-500'].forEach(function (name, i) {
        rootVars.push(name + ': ' + withAlpha(shift(base, step * i), alpha) + ' !important;');
      });
      rootVars.push('--bg-always-white: ' + withAlpha(shift(base, step), alpha) + ' !important;');
      rootVars.push('--bg-always-black: ' + withAlpha(shift(base, -step), alpha) + ' !important;');

      ['--border-100', '--border-200', '--border-300', '--border-400'].forEach(function (name) {
        rootVars.push(name + ': ' + withAlpha(light ? '#000000' : '#ffffff', 0.12) + ' !important;');
      });

      bodyRules.push('background-color: transparent !important;');
    }

    // ---- background layer -------------------------------------------
    if (usesImage) {
      var blur = clamp(s.bgImageBlur, 0, 40, 0);
      var dim = clamp(s.bgImageDim, 0, 100, 0) / 100;
      out.push(
        'html.cst-on::before {',
        '  content: "";',
        '  position: fixed;',
        '  inset: ' + (blur ? -(blur * 2 + 20) + 'px' : '0') + ';',
        '  z-index: -2;',
        '  pointer-events: none;',
        '  background-image: url("' + s.bgImage.trim().replace(/"/g, '%22') + '");',
        '  background-size: ' + s.bgImageSize + ';',
        '  background-position: center center;',
        '  background-repeat: no-repeat;',
        '  background-attachment: fixed;',
        blur ? '  filter: blur(' + blur + 'px);' : '',
        '}',
        'html.cst-on::after {',
        '  content: "";',
        '  position: fixed;',
        '  inset: 0;',
        '  z-index: -1;',
        '  pointer-events: none;',
        '  background: rgba(0, 0, 0, ' + dim + ');',
        '}',
        'html.cst-on { background-color: ' + (s.surfaceColor || s.bgColor) + ' !important; }'
      );
    } else if (bgLayer) {
      out.push(
        'html.cst-on {',
        '  background: ' + bgLayer + ' !important;',
        '  background-attachment: fixed !important;',
        '}'
      );
    }

    // ---- text colours ------------------------------------------------
    if (s.textColor) {
      ['--text-000', '--text-100', '--text-200'].forEach(function (name) {
        rootVars.push(name + ': ' + s.textColor + ' !important;');
      });
      // Muted ramp: same hue, softened.
      ['--text-300', '--text-400', '--text-500'].forEach(function (name) {
        rootVars.push(name + ': ' + withAlpha(s.textColor, 0.66) + ' !important;');
      });
      bodyRules.push('color: ' + s.textColor + ' !important;');
    }

    if (s.accentColor) {
      [
        '--accent-main-000',
        '--accent-main-100',
        '--accent-main-200',
        '--accent-pro-000',
        '--accent-pro-100',
        '--accent-brand',
        '--accent-secondary-100'
      ].forEach(function (name) {
        rootVars.push(name + ': ' + s.accentColor + ' !important;');
      });
    }

    // ---- fonts -------------------------------------------------------
    if (font) {
      [
        '--font-sans',
        '--font-serif',
        '--font-ui',
        '--font-user-message',
        '--font-claude-message',
        '--font-claude-response',
        '--font-tiempos',
        '--font-styrene'
      ].forEach(function (name) {
        rootVars.push(name + ': ' + font + ' !important;');
      });
      bodyRules.push('font-family: ' + font + ' !important;');

      if (s.forceFontEverywhere) {
        // Everything except code, icon fonts, and anything explicitly mono.
        out.push(
          'html.cst-on body :not(pre):not(code):not(kbd):not(samp):not(pre *):not(code *)' +
            ':not([class*="font-mono"]):not([class*="icon"]):not([class*="Icon"])' +
            ':not([class*="material-symbols"]):not(svg):not(svg *) {',
          '  font-family: ' + font + ' !important;',
          '}'
        );
      }
    }

    var scale = clamp(s.fontScale, 60, 200, 100);
    if (scale !== 100) {
      // The site sizes almost everything in rem, so moving the root size
      // scales type without breaking the layout maths.
      out.push('html.cst-on { font-size: ' + (16 * scale) / 100 + 'px !important; }');
    }

    var lineHeight = clamp(s.lineHeight, 0, 3, 0);
    if (lineHeight) {
      out.push(
        'html.cst-on body, html.cst-on p, html.cst-on li, html.cst-on .prose, html.cst-on [class*="prose"] {',
        '  line-height: ' + lineHeight + ' !important;',
        '}'
      );
    }

    var spacing = clamp(s.letterSpacing, -2, 4, 0);
    if (spacing) bodyRules.push('letter-spacing: ' + spacing + 'px !important;');

    var weight = clamp(s.fontWeight, 0, 900, 0);
    if (weight) {
      out.push(
        'html.cst-on body p, html.cst-on body li, html.cst-on body span:not([class*="icon"]) {',
        '  font-weight: ' + weight + ' !important;',
        '}'
      );
    }

    // ---- code --------------------------------------------------------
    if (codeFont || s.codeFontSize) {
      var codeRules = [];
      if (codeFont) {
        codeRules.push('font-family: ' + codeFont + ' !important;');
        rootVars.push('--font-mono: ' + codeFont + ' !important;');
      }
      var codeSize = clamp(s.codeFontSize, 0, 40, 0);
      if (codeSize) codeRules.push('font-size: ' + codeSize + 'px !important;');
      out.push(
        'html.cst-on :is(pre, code, kbd, samp, [class*="font-mono"]),',
        'html.cst-on :is(pre, code) * {',
        '  ' + codeRules.join('\n  '),
        '}'
      );
    }

    // ---- layout ------------------------------------------------------
    var width = clamp(s.chatWidth, 0, 3000, 0);
    if (width) {
      // The transcript column carries `epitaxy-transcript-width`; matching on
      // the suffix keeps working if the design-system prefix is renamed. The
      // Tailwind widths are a fallback for builds without that class.
      out.push(
        'html.cst-on [class*="transcript-width"] { max-width: ' + width + 'px !important; }',
        'html.cst-on main :is([class*="max-w-3xl"], [class*="max-w-2xl"]) {',
        '  max-width: ' + width + 'px !important;',
        '}'
      );
    }

    var turnGap = clamp(s.turnGap, 0, 200, 0);
    if (turnGap) {
      // Turn spacing comes from `pb-[var(--chat-turn-gap)]`, so redefining the
      // variable is enough — set it on the root and on the consuming elements
      // in case the site declares it further down the tree.
      rootVars.push('--chat-turn-gap: ' + turnGap + 'px !important;');
      out.push(
        'html.cst-on [class*="chat-turn-gap"] { --chat-turn-gap: ' + turnGap + 'px !important; }'
      );
    }

    if (s.hideSidebar) {
      out.push(
        'html.cst-on nav[class*="sidebar"], html.cst-on [data-testid*="sidebar"],',
        'html.cst-on aside:has(a[href*="/chat/"]), html.cst-on nav:has(a[href*="/new"]) {',
        '  display: none !important;',
        '}'
      );
    }

    // ---- assemble ----------------------------------------------------
    var css = [];
    if (rootVars.length) {
      css.push('html.cst-on, html.cst-on body, html.cst-on :root {\n  ' + rootVars.join('\n  ') + '\n}');
    }
    if (bodyRules.length) {
      css.push('html.cst-on body {\n  ' + bodyRules.join('\n  ') + '\n}');
    }
    css.push(
      out
        .filter(function (line) {
          return line !== '';
        })
        .join('\n')
    );

    if (s.customCss.trim()) {
      css.push('/* custom css */\n' + s.customCss);
    }

    return css
      .filter(function (chunk) {
        return chunk.trim();
      })
      .join('\n\n');
  }

  global.ClaudeSkin = {
    STORAGE_KEY: STORAGE_KEY,
    DEFAULTS: DEFAULTS,
    FONT_STACKS: FONT_STACKS,
    CODE_FONT_STACKS: CODE_FONT_STACKS,
    PRESETS: PRESETS,
    withDefaults: withDefaults,
    applyPreset: applyPreset,
    resolvedFont: resolvedFont,
    resolvedCodeFont: resolvedCodeFont,
    backgroundLayerCss: backgroundLayerCss,
    buildCss: buildCss,
    clone: clone
  };
})(typeof window !== 'undefined' ? window : globalThis);
