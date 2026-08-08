import { useEffect, useRef, useState, useCallback } from "react";
import { getDocument, PDFWorker, type PDFDocumentProxy } from "pdfjs-dist";
import { applyColorTransform, hexToRgb } from "../utils/colorTransform";
import BottomBar from "./BottomBar";
import CacheGrid from "./CacheGrid";
import type { CacheGridHandle } from "./CacheGrid";

const wasmUrl = "/";

function createPdfWorker(): Worker {
  return new Worker("/pdf.worker.min.mjs", { type: "module" });
}

const STORAGE_PREFIX = "happyread-page-";
const STORAGE_SCALE_PREFIX = "happyread-scale-";

function loadPage(key: string, fallback: number): number {
  try { return Number(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}

function loadScale(key: string, fallback: number): number {
  try { return Number(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}

const STORAGE_PRELOAD_LIMIT = "happyread-preload-limit";
const DEFAULT_CACHE_LIMIT = 0;

function loadPreloadLimit(): number {
  try { return Number(localStorage.getItem(STORAGE_PRELOAD_LIMIT)) || DEFAULT_CACHE_LIMIT; } catch { return DEFAULT_CACHE_LIMIT; }
}

interface Props {
  fileUrl: string;
  fileName: string;
  bgColor: string;
  fgColor: string;
  showUI?: boolean;
  active?: boolean;
  onBgColorChange?: (c: string) => void;
  onFgColorChange?: (c: string) => void;
  immersive?: boolean;
  onImmersiveChange?: (v: boolean) => void;
  windowOpacity?: number;
  onWindowOpacityChange?: (v: number) => void;
  onOpenFile?: () => void;
  onSetCover?: () => void;
  hasCover?: boolean;
}

const DEFAULT_SCALE = 1.0;
const MIN_SCALE = 0.25;

export default function PDFViewer({ fileUrl, fileName, bgColor, fgColor, showUI = false, active = true, onBgColorChange, onFgColorChange, immersive = false, onImmersiveChange, windowOpacity, onWindowOpacityChange, onOpenFile, onSetCover, hasCover }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const loadingTaskRef = useRef<{ destroy: () => void } | null>(null);
  const preloadDocsRef = useRef<PDFDocumentProxy[]>([]);
  const preloadLoadingTasksRef = useRef<Array<{ destroy: () => void }>>([]);
  const preloadIdxRef = useRef(0);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const pageRef = useRef(1);
  const directionRef = useRef(0);
  const colorsRef = useRef({ bg: bgColor, fg: fgColor });
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scale, setScale] = useState(() => fileName ? loadScale(STORAGE_SCALE_PREFIX + fileName, DEFAULT_SCALE) : DEFAULT_SCALE);
  const scaleRef = useRef(scale);

  useEffect(() => {
    if (!fileName) return;
    const saved = loadScale(STORAGE_SCALE_PREFIX + fileName, DEFAULT_SCALE);
    scaleRef.current = saved;
    setScale(saved);
  }, [fileName]);

  const renderScaleRef = useRef(2.0);
  const [isHighRes, setIsHighRes] = useState(true);
  const loadingRef = useRef(false);
  const showUIRef = useRef(showUI);
  showUIRef.current = showUI;
  const activeRef = useRef(active);
  activeRef.current = active;
  const preloadWindowRafRef = useRef(0);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const cacheLimitRef = useRef(loadPreloadLimit());
  const [cacheLimit, setCacheLimit] = useState(loadPreloadLimit());
  const cacheGridRef = useRef<CacheGridHandle>(null);
  const [rawMode, setRawMode] = useState(false);
  const rawModeRef = useRef(false);
  useEffect(() => { rawModeRef.current = rawMode; }, [rawMode]);
  const [barVisible, setBarVisible] = useState(true);

  useEffect(() => {
    const onMouseOut = (e: MouseEvent) => {
      if (!e.relatedTarget) setBarVisible(false);
    };
    const onMouseOver = () => setBarVisible(true);
    document.addEventListener("mouseout", onMouseOut);
    document.addEventListener("mouseover", onMouseOver);
    return () => {
      document.removeEventListener("mouseout", onMouseOut);
      document.removeEventListener("mouseover", onMouseOver);
    };
  }, []);

  const renderOneRaw = useCallback(async (
    num: number,
    pdf: PDFDocumentProxy | null,
    cancelMap?: Map<number, { cancel: () => void }>,
  ): Promise<ImageBitmap | null> => {
    if (!pdf) return null;

    const page = await pdf.getPage(num);
    const viewport = page.getViewport({ scale: renderScaleRef.current });
    const w = viewport.width, h = viewport.height;

    const c = typeof OffscreenCanvas === "undefined"
      ? (() => { const e = document.createElement("canvas"); e.width = w; e.height = h; return e; })()
      : new OffscreenCanvas(w, h);

    const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    const task = page.render({ canvas: c as unknown as HTMLCanvasElement, canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport });
    if (cancelMap) {
      cancelMap.set(num, task);
    } else {
      renderTaskRef.current = task;
    }
    try {
      await task.promise;
    } catch (e) {
      if (e instanceof Error && /cancelled/i.test(e.message)) return null;
      throw e;
    } finally {
      if (cancelMap) cancelMap.delete(num);
    }
    return await createImageBitmap(c);
  }, []);

  const pageCacheRef = useRef<Map<number, ImageBitmap>>(new Map());
  const displayCacheRef = useRef<Map<number, ImageData>>(new Map());
  const pageNaturalRef = useRef({ width: 0, height: 0 });
  const rgbCacheRef = useRef<{ bg: [number, number, number]; fg: [number, number, number] }>({ bg: hexToRgb(bgColor), fg: hexToRgb(fgColor) });

  const ensureDisplayData = (pageNum: number, source: ImageBitmap): ImageData => {
    if (showUIRef.current) {
      const cached = displayCacheRef.current.get(pageNum);
      if (cached) return cached;
    }

    const sw = source.width;
    const sh = source.height;
    const tmp = document.createElement("canvas");
    tmp.width = sw;
    tmp.height = sh;
    const tmpCtx = tmp.getContext("2d", { willReadFrequently: true })!;
    tmpCtx.drawImage(source, 0, 0);
    const raw = tmpCtx.getImageData(0, 0, sw, sh);
    const rgb = rgbCacheRef.current;
    const frame = new ImageData(new Uint8ClampedArray(raw.data), sw, sh);
    if (!rawModeRef.current) applyColorTransform(frame, rgb.bg, rgb.fg);
    if (showUIRef.current) {
      displayCacheRef.current.set(pageNum, frame);
    }
    return frame;
  };

  const displayImageData = useCallback((source: ImageBitmap, pageNum: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const displayData = ensureDisplayData(pageNum, source);
    const w = displayData.width;
    const h = displayData.height;
    pageNaturalRef.current = { width: w / renderScaleRef.current, height: h / renderScaleRef.current };

    let oc = offscreenRef.current;
    if (!oc) {
      oc = document.createElement("canvas");
      offscreenRef.current = oc;
    }
    oc.width = w;
    oc.height = h;
    const ocCtx = oc.getContext("2d")!;
    ocCtx.putImageData(displayData, 0, 0);

    const ratio = (scaleRef.current || DEFAULT_SCALE) / renderScaleRef.current;
    const dw = Math.round(w * ratio);
    const dh = Math.round(h * ratio);
    if (dw <= 0 || dh <= 0) return;

    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(oc, 0, 0, dw, dh);
    if (loadingRef.current) { loadingRef.current = false; setLoading(false); }
  }, []);

  const preloadQueueRef = useRef<number[]>([]);
  const activePreloadsRef = useRef(0);
  const preloadCancelRef = useRef<Map<number, { cancel: () => void }>>(new Map());
  const preloadTasksRef = useRef<Map<number, Promise<ImageBitmap | null>>>(new Map());
  const preloadWindowRef = useRef({ start: 1, end: 0 });

  const processQueue = useCallback(() => {
    const docs = preloadDocsRef.current;
    if (docs.length === 0) return;

    let idx = preloadIdxRef.current;
    let dispatched = 0;
    while (activePreloadsRef.current < 4 && preloadQueueRef.current.length > 0) {
      const n = preloadQueueRef.current.shift()!;
      if (n == null || pageCacheRef.current.has(n) || preloadTasksRef.current.has(n)) {
        continue;
      }
      const pdf = docs[idx % docs.length];
      idx++;
      activePreloadsRef.current++;
      dispatched++;
      const prom = renderOneRaw(n, pdf, preloadCancelRef.current);
      preloadTasksRef.current.set(n, prom);
      prom.then((data) => {
        if (data) {
          pageCacheRef.current.set(n, data);
          cacheGridRef.current?.drawCell(n);
        }
      }).catch(() => {}).finally(() => {
        preloadTasksRef.current.delete(n);
        activePreloadsRef.current--;
        processQueue();
      });
    }
    preloadIdxRef.current = idx;
  }, [renderOneRaw]);

  const ensurePreloadWindow = useCallback((current: number) => {
    const pdf = docRef.current;
    if (!pdf) return;
    const limit = cacheLimitRef.current;
    const numPages = pdf.numPages;
    let start: number, end: number;
    if (limit === -1) {
      for (const bmp of pageCacheRef.current.values()) bmp.close();
      pageCacheRef.current.clear();
      for (const [, task] of preloadCancelRef.current) task.cancel();
      preloadCancelRef.current.clear();
      preloadTasksRef.current.clear();
      preloadQueueRef.current = [];
      activePreloadsRef.current = 0;
      preloadWindowRef.current = { start: 0, end: 0 };
      return;
    } else if (limit === 0) {
      start = 1; end = numPages;
    } else {
      const half = Math.floor(limit / 2);
      start = current - half;
      end = current + half;
      if (start < 1) { end += (1 - start); start = 1; }
      if (end > numPages) { start -= (end - numPages); end = numPages; }
      if (start < 1) start = 1;
      if (end > numPages) end = numPages;
    }

    const prev = preloadWindowRef.current;
    if (start === prev.start && end === prev.end) {
      processQueue();
      return;
    }
    preloadWindowRef.current = { start, end };

    for (const [page, task] of preloadCancelRef.current) {
      if (page < start || page > end) {
        task.cancel();
        preloadCancelRef.current.delete(page);
      }
    }

    for (const key of pageCacheRef.current.keys()) {
      if (key < start || key > end) {
        const bmp = pageCacheRef.current.get(key);
        if (bmp) bmp.close();
        pageCacheRef.current.delete(key);
        displayCacheRef.current.delete(key);
      }
    }

    const kept = preloadQueueRef.current.filter((p) => p >= start && p <= end);
    const inSet = new Set(kept);
    const toAdd: number[] = [];
    for (let i = start; i <= end; i++) {
      if (!pageCacheRef.current.has(i) && !preloadTasksRef.current.has(i) && !inSet.has(i)) {
        toAdd.push(i);
      }
    }
    const sortByDist = (a: number, b: number) => {
      const da = Math.abs(a - current);
      const db = Math.abs(b - current);
      if (da !== db) return da - db;
      const dir = directionRef.current;
      return dir > 0 ? a - b : dir < 0 ? b - a : a - b;
    };
    toAdd.sort(sortByDist);
    const merged = [...kept, ...toAdd];
    merged.sort(sortByDist);
    preloadQueueRef.current = merged;
    processQueue();
  }, [processQueue]);

  const renderPage = useCallback(async (num: number) => {
    const pdf = docRef.current;
    if (!pdf || !canvasRef.current) return;

    renderTaskRef.current?.cancel();
    setError("");

    if (!showUIRef.current) {
      try {
        loadingRef.current = true; setLoading(true);
        const rawData = await renderOneRaw(num, pdf);
        if (!rawData) return;
        displayImageData(rawData, num);
      } catch (e: unknown) {
        if (e instanceof Error && /cancelled/i.test(e.message)) return;
        setError(e instanceof Error ? e.message : String(e));
      }
      return;
    }

    const cached = showUIRef.current ? pageCacheRef.current.get(num) : undefined;
    if (cached) {
      displayImageData(cached, num);
      return;
    }

    const pending = preloadTasksRef.current.get(num);
    if (pending) {
      loadingRef.current = true; setLoading(true);
      try {
        const rawData = await pending;
        if (rawData) {
          displayImageData(rawData, num);
          return;
        }
      } catch (_e) { /* pending failed, fall through to direct render */ }
    }

    try {
      loadingRef.current = true; setLoading(true);
      const rawData = await renderOneRaw(num, pdf);
      if (!rawData) return;
      if (showUIRef.current) pageCacheRef.current.set(num, rawData);
      cacheGridRef.current?.drawCell(num);
      displayImageData(rawData, num);
    } catch (e: unknown) {
      if (e instanceof Error && /cancelled/i.test(e.message)) return;
      setError(e instanceof Error ? e.message : String(e));
      loadingRef.current = false; setLoading(false);
    }
  }, [renderOneRaw, displayImageData]);

  const renderPageRef = useRef(renderPage);
  renderPageRef.current = renderPage;

  const setRawModeExplicit = useCallback((v: boolean) => {
    if (rawModeRef.current === v) return;
    rawModeRef.current = v;
    setRawMode(v);
    displayCacheRef.current.clear();
    renderPageRef.current(pageRef.current);
  }, []);

  const zoomBy = useCallback((delta: number) => {
    let upper = Infinity;
    if (delta > 0) {
      const avail = scrollRef.current?.clientWidth ?? 0;
      const nw = pageNaturalRef.current.width;
      if (avail > 0 && nw > 0) {
        const fit = avail / nw;
        if (scaleRef.current >= fit) return;
        upper = fit;
      }
    }
    const s = Math.max(MIN_SCALE, Math.min(upper, +(scaleRef.current + delta).toFixed(3)));
    if (s === scaleRef.current) return;
    scaleRef.current = s;
    setScale(s);
    if (fileName) try { localStorage.setItem(STORAGE_SCALE_PREFIX + fileName, String(s)); } catch {}
    const cached = pageCacheRef.current.get(pageRef.current);
    if (cached) {
      displayImageData(cached, pageRef.current);
    } else {
      renderPageRef.current(pageRef.current);
    }
  }, [displayImageData, fileName]);

  const zoomIn = useCallback(() => zoomBy(0.25), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(-0.25), [zoomBy]);

  const fitToWidth = useCallback(() => {
    const container = scrollRef.current;
    const nw = pageNaturalRef.current.width;
    if (!container || nw <= 0) return;
    const avail = container.clientWidth;
    if (avail <= 0) return;
    const fit = Math.max(MIN_SCALE, avail / nw);
    const cur = scaleRef.current;
    if (Math.abs(fit - cur) < 0.005) return;
    scaleRef.current = fit;
    setScale(fit);
    if (fileName) try { localStorage.setItem(STORAGE_SCALE_PREFIX + fileName, String(fit)); } catch {}
    const cached = pageCacheRef.current.get(pageRef.current);
    if (cached) {
      displayImageData(cached, pageRef.current);
    } else {
      renderPageRef.current(pageRef.current);
    }
  }, [displayImageData, fileName]);

  const toggleQuality = useCallback(() => {
    const next = renderScaleRef.current === 2.0 ? 1.0 : 2.0;
    renderScaleRef.current = next;
    setIsHighRes(next === 2.0);
    for (const bmp of pageCacheRef.current.values()) bmp.close();
    pageCacheRef.current.clear();
    displayCacheRef.current.clear();
    for (const [, task] of preloadCancelRef.current) task.cancel();
    preloadCancelRef.current.clear();
    preloadTasksRef.current.clear();
    preloadQueueRef.current = [];
    activePreloadsRef.current = 0;
    renderPageRef.current(pageRef.current);
    ensurePreloadWindow(pageRef.current);
  }, [ensurePreloadWindow]);

  const toggleMaximize = useCallback(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
    import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      const w = getCurrentWindow();
      w.isMaximized().then((m) => (m ? w.unmaximize() : w.maximize())).catch(() => {});
    }).catch(() => {});
  }, []);

  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleScrollPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
    if (e.target !== canvasRef.current) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  }, []);

  const handleScrollPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    if (Math.abs(e.clientX - start.x) < 4 && Math.abs(e.clientY - start.y) < 4) return;
    dragStartRef.current = null;
    import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      getCurrentWindow().startDragging().catch(() => {});
    }).catch(() => {});
  }, []);

  const handleScrollPointerUp = useCallback(() => {
    dragStartRef.current = null;
  }, []);

  const zoomInRef = useRef(zoomIn);
  zoomInRef.current = zoomIn;
  const zoomOutRef = useRef(zoomOut);
  zoomOutRef.current = zoomOut;
  const zoomByRef = useRef(zoomBy);
  zoomByRef.current = zoomBy;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomByRef.current(-e.deltaY * 0.001);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => fitToWidth());
    });
    ro.observe(el, { box: "border-box" });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [fitToWidth]);

  useEffect(() => {
    if (!fileUrl) return;

    const saved = fileName ? loadPage(STORAGE_PREFIX + fileName, 1) : 1;
    const loadingTask = getDocument({ url: fileUrl, wasmUrl, worker: new PDFWorker({ port: createPdfWorker() as never }) });
    loadingTaskRef.current = loadingTask;
    preloadLoadingTasksRef.current = [];
    preloadDocsRef.current = [];
    preloadIdxRef.current = 0;

    (async () => {
      try {
        const pdf = await loadingTask.promise;
        docRef.current = pdf;
        setTotalPages(pdf.numPages);
        const target = Math.min(saved, pdf.numPages);
        pageRef.current = target;
        setPageNum(target);
        ensurePreloadWindow(target);
        preloadQueueRef.current = preloadQueueRef.current.filter((p) => p !== target);
        renderPageRef.current(target);
        (async () => {
          for (let i = 0; i < 600 && pageNaturalRef.current.width <= 0; i++) {
            await new Promise((r) => requestAnimationFrame(r));
          }
          fitToWidth();
        })();

        if (showUI) {
          for (let w = 0; w < 2; w++) {
            const pt = getDocument({ url: fileUrl, wasmUrl, worker: new PDFWorker({ port: createPdfWorker() as never }) });
            preloadLoadingTasksRef.current.push(pt);
            try {
              const pp = await pt.promise;
              preloadDocsRef.current.push(pp);
              if (docRef.current) {
                const cur = pageRef.current;
                ensurePreloadWindow(cur);
                preloadQueueRef.current = preloadQueueRef.current.filter((p) => p !== cur);
              }
            } catch (_e) { /* preload doc failed, continue without it */ }
          }
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      loadingTaskRef.current?.destroy();
      for (const t of preloadLoadingTasksRef.current) t.destroy();
      preloadLoadingTasksRef.current = [];
      docRef.current = null;
      preloadDocsRef.current = [];
      for (const bmp of pageCacheRef.current.values()) bmp.close();
      pageCacheRef.current.clear();
      displayCacheRef.current.clear();
      for (const [, task] of preloadCancelRef.current) task.cancel();
      preloadCancelRef.current.clear();
      preloadTasksRef.current.clear();
      preloadQueueRef.current = [];
      activePreloadsRef.current = 0;
      directionRef.current = 0;
      cancelAnimationFrame(preloadWindowRafRef.current);
      preloadWindowRafRef.current = 0;
    };
  }, [fileUrl, fileName, ensurePreloadWindow, showUI, fitToWidth]);

  useEffect(() => {
    if (!docRef.current) return;
    if (colorsRef.current.bg === bgColor && colorsRef.current.fg === fgColor) return;
    colorsRef.current = { bg: bgColor, fg: fgColor };
    rgbCacheRef.current = { bg: hexToRgb(bgColor), fg: hexToRgb(fgColor) };
    displayCacheRef.current.clear();
    renderPageRef.current(pageRef.current);
  }, [bgColor, fgColor]);

  const goToPage = useCallback((num: number) => {
    if (num < 1 || num > totalPages || !docRef.current) return;
    directionRef.current = num > pageRef.current ? 1 : num < pageRef.current ? -1 : 0;
    pageRef.current = num;
    setPageNum(num);
    renderPageRef.current(num);
    scrollRef.current?.scrollTo(0, 0);
    if (fileName) {
      try { localStorage.setItem(STORAGE_PREFIX + fileName, String(num)); } catch {}
    }
    if (!preloadWindowRafRef.current) {
      preloadWindowRafRef.current = requestAnimationFrame(() => {
        preloadWindowRafRef.current = 0;
        ensurePreloadWindow(pageRef.current);
      });
    }
  }, [totalPages, fileName, ensurePreloadWindow]);

  const goToPageRef = useRef(goToPage);
  goToPageRef.current = goToPage;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!activeRef.current) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        const next = pageRef.current - 1;
        if (next >= 1) goToPageRef.current(next);
      } else if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        const next = pageRef.current + 1;
        if (next <= totalPages) goToPageRef.current(next);
      } else if (e.key === "ArrowUp" && e.ctrlKey) {
        e.preventDefault();
        zoomInRef.current();
      } else if (e.key === "ArrowDown" && e.ctrlKey) {
        e.preventDefault();
        zoomOutRef.current();
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        if (!e.altKey) scrollRef.current?.focus();
      } else if (e.key === " ") {
        e.preventDefault();
        scrollRef.current?.focus();
        scrollRef.current?.scrollBy({ top: scrollRef.current.clientHeight * 0.9, behavior: "smooth" });
      } else if (e.key === "Escape") {
        onImmersiveChange?.(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [totalPages, onImmersiveChange]);

  return (
    <div className="absolute inset-0 flex flex-col">
      <style>{`
        .scrollbar-hidden::-webkit-scrollbar-thumb {
          background-color: ${fgColor} !important;
        }
        .scrollbar-hidden::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-hidden::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .scrollbar-hidden-imm::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .scrollbar-hidden-imm::-webkit-scrollbar-thumb,
        .scrollbar-hidden-imm::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
      <div
        ref={scrollRef}
        tabIndex={-1}
        onDoubleClick={toggleMaximize}
        onPointerDown={handleScrollPointerDown}
        onPointerMove={handleScrollPointerMove}
        onPointerUp={handleScrollPointerUp}
        className={"flex-1 min-h-0 flex flex-col items-center overflow-auto outline-none " + (immersive || !barVisible ? "scrollbar-hidden-imm" : "scrollbar-hidden")}
        style={{ backgroundColor: bgColor, scrollbarGutter: "stable", scrollbarColor: immersive || !barVisible ? "transparent transparent" : `${fgColor} transparent` }}
      >
      {error && <p className="text-red-400 my-4 shrink-0">错误: {error}</p>}
      <canvas ref={canvasRef} className={error ? "hidden" : "block shadow-md mx-auto shrink-0 min-h-0"} />
      </div>
      <BottomBar
        pageNum={pageNum}
          totalPages={totalPages}
          loading={loading}
          scale={scale}
          fgColor={fgColor}
          bgColor={bgColor}
          isHighRes={isHighRes}
          rawMode={rawMode}
          immersive={immersive}
          showUI={showUI}
          goToPage={goToPage}
          zoomIn={zoomIn}
          zoomOut={zoomOut}
          toggleQuality={toggleQuality}
          onSetRawMode={setRawModeExplicit}
          onBgColorChange={onBgColorChange}
          onFgColorChange={onFgColorChange}
          onImmersiveChange={onImmersiveChange}
          windowOpacity={windowOpacity}
          onWindowOpacityChange={onWindowOpacityChange}
          onOpenFile={onOpenFile}
          onSetCover={onSetCover}
          hasCover={hasCover}
          barVisible={barVisible}
        />
      <CacheGrid
        ref={cacheGridRef}
        totalPages={totalPages}
        pageNum={pageNum}
        fgColor={fgColor}
        bgColor={bgColor}
        immersive={immersive}
        showUI={showUI}
        cacheLimit={cacheLimit}
        onCacheLimitChange={(v) => {
          cacheLimitRef.current = v;
          setCacheLimit(v);
          try { localStorage.setItem(STORAGE_PRELOAD_LIMIT, String(v)); } catch {}
          ensurePreloadWindow(pageRef.current);
        }}
        onGoToPage={goToPage}
        hasPage={(p) => pageCacheRef.current.has(p)}
        isPreloading={(p) => preloadTasksRef.current.has(p)}
        barVisible={barVisible}
      />
    </div>
  );
}
