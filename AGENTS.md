# Happy Read PDF — AGENTS.md

## Stack
- **Tauri v2** desktop app: Rust backend (`src-tauri/`) + React 19 frontend (`src/`)
- **Build**: `npm run build` = `tsc -b && vite build` (typecheck then bundle)
- **Dev**: `npm run dev` — opens Vite at `http://localhost:5173`
- **Lint**: `oxlint` only (no ESLint). Run with `npm run lint`
- **Tests**: none exist; no test framework in deps

## TypeScript quirks
- `verbatimModuleSyntax: true` — always `import type` for type-only imports
- `erasableSyntaxOnly: true` — no enums, no namespaces, no parameter properties
- `noUnusedLocals: true` + `noUnusedParameters: true` — unused vars/params are build errors

## Tailwind v4 (not v3)
- Uses `@import "tailwindcss"` in CSS (no `@tailwind` directives)
- Plugin is `@tailwindcss/vite` — no PostCSS config file

## Tauri specifics
- Plugins: `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-global-shortcut`
- On Windows, building requires MSVC (`vcvars64.bat`). Scripts at `src-tauri/`:
  - `build.bat` — `cargo build` with vcvars64
  - `build_app.bat` — `npx tauri build` with vcvars64
  - `build_env.bat` — sets vcvars64 env vars for the current shell
- Capabilities at `src-tauri/capabilities/default.json`
- Global shortcut (Alt+Backtick) registered in Rust (`src-tauri/src/lib.rs`), not JS

## Architecture

### Entry points
- React: `src/main.tsx` → `<App />`
- Rust: `src-tauri/src/main.rs` → `app_lib::run()`

### File structure
```
src/
  App.tsx             — top-level layout, boss-key logic, toolbar toggle, color state
  components/
    PDFViewer.tsx     — PDF loading, rendering, preloading, keyboard nav, immersive
    BottomBar.tsx     — bottom toolbar: page nav, zoom, quality, theme, immersive
    Toolbar.tsx       — top bar: file open/cover controls
    ColorCustomizer.tsx — theme dropdown (first item "原始" for raw mode) + bg/fg color pickers. Used only in BottomBar (removed from Toolbar).
    CacheGrid.tsx     — cache status grid overlay (blue=current, green=cached, gray=preloading, red=unloaded)
  utils/
    colorTransform.ts — pixel-level color remap (bg/fg substitution by luminance)
    fullscreen.ts     — Tauri-aware fullscreen (hides decorations in Tauri, else Fullscreen API)
    pdfCache.ts       — IndexedDB blob cache for loaded PDFs (keys: "real", "cover")
```

### PDF rendering pipeline
1. **pdfjs-dist** renders each page at `renderScaleRef.current` (1.0 or 2.0, default 2.0) to an OffscreenCanvas (DOM canvas fallback)
2. Raw render is converted to `ImageBitmap` (GPU-backed, lightweight) via `createImageBitmap(canvas)` and cached in `pageCacheRef` (Map in-memory)
3. Preloading uses **2 separate `PDFDocumentProxy`** (`preloadDocsRef[]`) each with its own Web Worker — round-robin dispatching in `processQueue` gives truly parallel rendering (2x throughput). Only created when `showUI=true` (real PDF only, not cover)
4. `ensurePreloadWindow` evicts pages outside window, calling `bitmap.close()` to free GPU resources; **short-circuits** if start/end unchanged (avoids O(numPages) per call when window static)
5. Color transform is **on-demand only**: `displayImageData()` calls `ensureDisplayData(pageNum, source)` which checks `displayCacheRef` first; on miss, converts `ImageBitmap` → `ImageData` via temp canvas with `{ willReadFrequently: true }`, applies `applyColorTransform()`, caches result; draws to main canvas at `(currentScale / renderScaleRef.current)` ratio
6. Color-transformed `ImageData` is cached per-page in `displayCacheRef` (unlimited, cleared only on file/color change) — repeat visits are instant
7. Custom color transform maps white → bgColor, black → fgColor per-pixel: uses `Uint32Array` single-write + fast-path for R/G/B all >200 or <55, skipping luminance multiply for ~85% of PDF pixels

### Preloading (`processQueue`)
- Sliding window cache: `ensurePreloadWindow(current)` evicts pages outside `[current ± half]`, queues in-range pages
- Window unchanged → early return (calls `processQueue()` only to check for idle workers)
- Cache limit from localStorage key `happyread-preload-limit` (0 = all pages)
- 4 concurrent renders across 2 workers (2 per worker), round-robin dispatch
- No stagger delay between concurrent preloads
- Cache grid canvas (8px cells, 20 cols) shows blue=current, green=cached, gray=in-flight preload, red=unloaded

### State persistence
| Data | Storage |
|---|---|
| bg/fg color | `happyread-bg`, `happyread-fg` (localStorage) |
| Last page per file | `happyread-page-<fileName>` (localStorage) |
| Zoom scale per file | `happyread-scale-<fileName>` (localStorage) |
| Preload window size | `happyread-preload-limit` (localStorage) |
| PDF file blobs | IndexedDB `happyread-pdf-cache` (keys: "real", "cover") |

### Boss key (Alt+Backtick)
- Rust: hides/shows the Tauri window globally
- JS: toggles between "real" PDF and "cover" PDF. Only works if both PDFs are loaded.

## Key shortcuts
| Key | Action |
|---|---|
| `Alt+`` ` | Toggle real/cover PDF; also hide/show window globally |
| `F11` | Toggle fullscreen |
| `←` / `PageUp` | Previous page |
| `→` / `PageDown` | Next page |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `↑` / `↓` | Scroll the PDF canvas |
| `Space` | Scroll down one viewport |
| `Esc` | Exit immersive mode |

## Notable conventions
- All UI text in simplified Chinese
- Immersive mode state lifted to `App.tsx`; both `<Toolbar>` and bottom bar hidden via `hidden={immersive}`
- Immersive toggle button merged with fullscreen into a single "沉浸" button in the bottom-right corner; rendered outside `!immersive` guard so it's clickable during immersive mode. Both real and cover PDF share this button.
- Cache grid is an independent component (`CacheGrid.tsx`) with a toggle button in the top-right corner; grid panel appears below it at `top-10 right-3`. Uses `forwardRef` + `useImperativeHandle` to expose `drawCell` for the parent to update individual cells.
- `renderScaleRef` defaults 2.0; toggle-able to 1.0 via "高清"/"标清" button (always visible). Switching clears all caches and re-renders at new resolution.
- `displayImageData` avoids `getImageData()` readback from display canvas — uses `new ImageData(new Uint8ClampedArray(...))` instead
- `displayCacheRef` caches already-transformed ImageData (unlimited, cleared only on file/color change) — repeat visits are instant
- `pageCacheRef` stores `ImageBitmap` (GPU-backed, no `getImageData` during preload) — `bitmap.close()` on eviction; NOT cleared on color change
- Color change clears only `displayCacheRef`, re-applies transform to current page on next display
- Rendering a page cancels the main `renderTaskRef.current` (navigation) but not in-flight preloads
- `ensureDisplayData` uses temp canvas with `{ willReadFrequently: true }` — eliminates GPU→CPU readback stalls (was 569ms, now ~5ms)
- `goToPage` renders synchronously for instant visual feedback; `ensurePreloadWindow` throttled via RAF to once per frame
- Cover PDF (`showUI=false`): skips preload worker creation, skips cache read/write, keyboard events gated by `active` prop
- `active` prop on `<PDFViewer>` gates global `keydown` listener — both instances registered globally; only the active one responds
- Root div in PDFViewer uses `absolute inset-0` + `scrollbarGutter: "stable"`; parent in App.tsx must be `flex-1 relative` for scrollbar to appear after zoom

## Resolved issues

### EXE renders only first and last page (middle pages blank) — FIXED
**Root cause**: Vite production build content-hashes `jbig2.wasm` → `jbig2-CNFLgX9F.wasm`. But `wasmUrl` was derived from the hashed import path:

```ts
// BEFORE (broken):
import jbig2Wasm from "pdfjs-dist/wasm/jbig2.wasm?url";
const wasmUrl = jbig2Wasm.substring(0, jbig2Wasm.lastIndexOf("/") + 1);
// Production: wasmUrl = "/assets/" → pdfjs looks for "/assets/jbig2.wasm" → 404
// Dev (Vite resolves from node_modules): works fine
```

pdfjs looks up wasm files by ORIGINAL name (`jbig2.wasm`) in `wasmUrl` directory. In production, the hashed name doesn't match → JBIG2 decoding fails → pages with JBIG2 images render blank. Pure-text pages (title, blank last page) are unaffected.

**Fix** (*2026-07-26*):
1. Copy all pdfjs wasm files to `public/` (served without hashing):
   ```
   public/jbig2.wasm  public/openjpeg.wasm  public/qcms_bg.wasm
   public/quickjs-eval.wasm  public/quickjs-eval.js
   ```
2. Set `wasmUrl = "/"` (wasm served at root); remove the `jbig2Wasm?url` import.

### Worker loading
Worker also uses `workerPort` (per-document `PDFWorker`) to avoid pdfjs's internal `import(workerSrc)` which can fail in WebView2. Not the root cause, but kept as proactive fix.

## Build notes
- EXE copied to `D:\DCK\Desktop\HappyReadPDF.exe` after each `build_app.bat`
- Before copying, `taskkill /f /im HappyReadPDF.exe` may be needed to unlock the file
- `build_app.bat` (`src-tauri/`) calls VS18 vcvars64 then `npx tauri build`

## Dev server env
- `TAURI_DEV_HOST` enables HMR over network (sets `server.host` and `hmr`)
- `TAURI_ENV_DEBUG` enables sourcemaps and disables minification
- Vite watches `src/` but ignores `src-tauri/`
