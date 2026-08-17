# Claude Skin

A Firefox extension that restyles **claude.ai** from a toolbar popup — background,
fonts, sizes, colours, chat width, and a custom-CSS escape hatch. Changes apply
live to any open Claude tab; nothing is sent anywhere, everything is stored
locally by the browser.

## Install (temporary, for development)

1. Open `about:debugging#/runtime/this-firefox`.
2. **Load Temporary Add-on…** → pick `manifest.json` in this folder.
3. Open <https://claude.ai>, click the Claude Skin toolbar button, start tweaking.

Temporary add-ons are removed when Firefox restarts. For a permanent install the
add-on has to be signed by Mozilla:

```sh
npx web-ext lint          # validate
npx web-ext build         # -> web-ext-artifacts/claude_skin-1.0.0.zip
npx web-ext sign --channel=unlisted --api-key=… --api-secret=…
```

The signed `.xpi` can then be installed from `about:addons` → gear → *Install
Add-on From File*.

## What the popup controls

| Tab | Controls |
| --- | --- |
| **Background** | Solid colour, gradient (two stops + angle), or image (URL or a local file embedded as a data URI, with fit / blur / dim). Plus panel colour and panel opacity, which decide how much of the background shows through the chat surfaces. |
| **Text** | Font family (system fonts + custom stack), force-font toggle, size scale, line height, letter spacing, weight, text colour, accent colour. |
| **Layout** | Chat column width, hide the conversation sidebar, code font family and code font size. |
| **Advanced** | Free-form custom CSS, a read-only view of the generated stylesheet, and settings export/import as JSON. |

Five presets — Midnight, Paper, Terminal, Solarized, Focus — fill everything in
at once as a starting point. The master switch in the header disables all styling
without losing your configuration, and **Reset all** returns to stock.

## How it works

`content/apply.js` keeps one `<style id="claude-skin-tweaks">` element at the end
of `<head>` and rewrites it whenever settings change. The stylesheet itself is
produced by `ClaudeSkin.buildCss()` in `common/settings.js`.

The main strategy is **redefining claude.ai's own CSS custom properties** rather
than chasing generated class names. The site is Tailwind-based with its palette
and typography exposed as tokens on the root element:

```
--bg-000 … --bg-500          surface ramp
--text-000 … --text-500      text ramp
--border-100 … --border-400  borders
--accent-main-000 …          accent / brand colours
--font-sans, --font-serif, --font-mono
--font-user-message, --font-claude-message, --font-claude-response
```

Overriding those propagates through every component that uses them, and it keeps
working when the site ships new markup. Broad `!important` rules follow as a
safety net for anything that hardcodes a value, and a couple of features
(chat width, hide sidebar) do have to match on structure:

```css
main [class*="max-w-"]        /* chat column */
nav[class*="sidebar"], aside:has(a[href*="/chat/"])   /* sidebar */
```

**Those two are the fragile parts.** If Claude's markup shifts and they stop
working, the fix is a selector swap in `common/settings.js` — or a rule in the
custom CSS box. If you send me the class names or `data-testid` values you see
in the inspector for the elements you want to hit, I'll wire them in properly
instead of relying on the substring matches above.

## Notes and limitations

- **Fonts must be installed locally.** claude.ai's Content-Security-Policy blocks
  webfonts from third-party hosts, so the font list only offers families the
  browser can already resolve. Custom stacks work the same way.
- **Background images**: local files are embedded as data URIs (3 MB cap) and
  always work. A remote `https://` URL depends on the site's CSP allowing that
  host — if an image silently fails to appear, that's why; use a local file.
- The extension also matches `claude.com`, so it keeps working if the app moves.
- Settings live in `storage.local` (not `sync`) because embedded images blow past
  the sync quota. Use **Fill & copy** / **Apply pasted** in the Advanced tab to
  move a configuration between machines.

## Layout

```
manifest.json          Manifest V2 (works in every current Firefox)
manifest.mv3.json      Manifest V3 variant — rename over manifest.json to use it
common/settings.js     Settings schema, presets, and the CSS generator
content/apply.js       Injects and maintains the <style> element
popup/                 popup.html / popup.css / popup.js
icons/icon.svg
```

MV2 is the default because Firefox grants its host permissions at install time,
so the content script runs with no extra prompt. The MV3 variant is functionally
identical; under MV3 you may have to grant site access from the extension's
permissions panel before styling appears.
