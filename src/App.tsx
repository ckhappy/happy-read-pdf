import { useState, useCallback, useRef, useEffect } from "react";
import PDFViewer from "./components/PDFViewer";
import WindowControls from "./components/WindowControls";
import { savePDFCache, loadPDFCache, deletePDFCache } from "./utils/pdfCache";
import { toggleFullscreen } from "./utils/fullscreen";
import { darkenColor } from "./utils/colorTransform";
import { BOSS_KEY_STORAGE, DEFAULT_BOSS_COMBO } from "./components/BossKeyButton";
import "./index.css";

function loadColor(key: string, fallback: string): string {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}

function loadNumber(key: string, fallback: number): number {
  try { return Number(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}

function loadBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v !== "0";
  } catch { return fallback; }
}

const MIN_OPACITY = 10;
const OPACITY_STEP = 5;
const BOSS_FADE_MS = 150;

export default function App() {
  const [realFileUrl, setRealFileUrl] = useState("");
  const [realFileName, setRealFileName] = useState("");
  const [coverFileUrl, setCoverFileUrl] = useState("");
  const [coverFileName, setCoverFileName] = useState("");
  const [showingReal, setShowingReal] = useState(true);
  const [bgColor, setBgColor] = useState(() => loadColor("happyread-bg", "#1e1e2e"));
  const [fgColor, setFgColor] = useState(() => loadColor("happyread-fg", "#cdd6f4"));
  const [opacity, setOpacity] = useState(() => loadNumber("happyread-window-opacity", 100));
  const [bossOpacity, setBossOpacity] = useState<number | null>(null);
  const [alwaysOnTop, setAlwaysOnTop] = useState(() => loadBool("happyread-topmost", true));
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => { localStorage.setItem("happyread-bg", bgColor); }, [bgColor]);
  useEffect(() => { localStorage.setItem("happyread-fg", fgColor); }, [fgColor]);
  useEffect(() => { localStorage.setItem("happyread-window-opacity", String(opacity)); }, [opacity]);
  useEffect(() => { localStorage.setItem("happyread-topmost", alwaysOnTop ? "1" : "0"); }, [alwaysOnTop]);

  useEffect(() => {
    import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      getCurrentWindow().setAlwaysOnTop(alwaysOnTop).catch(() => {});
    });
  }, [alwaysOnTop]);

  const [immersive, setImmersive] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const realInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const realFileUrlRef = useRef(realFileUrl);
  realFileUrlRef.current = realFileUrl;
  const coverFileUrlRef = useRef(coverFileUrl);
  coverFileUrlRef.current = coverFileUrl;
  const bossFadingRef = useRef(false);

  useEffect(() => {
    (async () => {
      const [real, cover] = await Promise.all([loadPDFCache("real"), loadPDFCache("cover")]);
      if (real) {
        const blob = new Blob([real.data]);
        setRealFileUrl(URL.createObjectURL(blob));
        setRealFileName(real.fileName);
      }
      if (cover) {
        const blob = new Blob([cover.data]);
        setCoverFileUrl(URL.createObjectURL(blob));
        setCoverFileName(cover.fileName);
      }
      setInitialLoading(false);
    })();
  }, []);

  useEffect(() => {
    let combo = DEFAULT_BOSS_COMBO;
    try { combo = localStorage.getItem(BOSS_KEY_STORAGE) || combo; } catch {}
    import("@tauri-apps/api/core").then(({ invoke }) => {
      invoke("set_boss_shortcut", { combo }).catch(() => {});
    });
  }, []);

  useEffect(() => {
    let unlisteners: Array<() => void> = [];
    let disposed = false;
    import("@tauri-apps/api/event").then(({ listen }) => {
      if (disposed) return;
      const p1 = listen<void>("boss-pressed", () => {
        if (coverFileUrlRef.current) {
          setShowingReal((v) => !v);
          return;
        }
        if (bossFadingRef.current) return;
        bossFadingRef.current = true;
        setBossOpacity(0);
        setTimeout(() => {
          import("@tauri-apps/api/core").then(({ invoke }) => {
            invoke("boss_hide").catch(() => {});
          });
        }, BOSS_FADE_MS);
      });
      const p2 = listen<void>("boss-restore", () => {
        bossFadingRef.current = false;
        setBossOpacity(null);
      });
      p1.catch(() => {});
      p2.catch(() => {});
      Promise.all([p1, p2]).then(([u1, u2]) => {
        if (disposed) {
          u1();
          u2();
          return;
        }
        unlisteners = [u1, u2];
      });
    });
    return () => {
      disposed = true;
      unlisteners.forEach((u) => u());
    };
  }, []);

  const handleOpenFile = useCallback(() => {
    realInputRef.current?.click();
  }, []);

  const handleSetCover = useCallback(() => {
    coverInputRef.current?.click();
  }, []);

  const handleRealFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (realFileUrlRef.current) URL.revokeObjectURL(realFileUrlRef.current);
    const arrayBuffer = await file.arrayBuffer();
    setRealFileName(file.name);
    setRealFileUrl(URL.createObjectURL(new Blob([arrayBuffer])));
    setShowingReal(true);
    savePDFCache("real", file.name, arrayBuffer).catch(() => {});
  }, []);

  const handleCoverFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (coverFileUrl) URL.revokeObjectURL(coverFileUrl);
    const arrayBuffer = await file.arrayBuffer();
    setCoverFileName(file.name);
    setCoverFileUrl(URL.createObjectURL(new Blob([arrayBuffer])));
    savePDFCache("cover", file.name, arrayBuffer).catch(() => {});
  }, [coverFileUrl]);

  const handleRemoveReal = useCallback(() => {
    if (realFileUrlRef.current) URL.revokeObjectURL(realFileUrlRef.current);
    setRealFileUrl("");
    setRealFileName("");
    deletePDFCache("real").catch(() => {});
  }, []);

  const handleRemoveCover = useCallback(() => {
    if (coverFileUrl) URL.revokeObjectURL(coverFileUrl);
    setCoverFileUrl("");
    setCoverFileName("");
    deletePDFCache("cover").catch(() => {});
    setShowingReal(true);
  }, [coverFileUrl]);

  const handleRemoveAll = useCallback(() => {
    handleRemoveReal();
    handleRemoveCover();
  }, [handleRemoveReal, handleRemoveCover]);

  const handleImmersiveChange = useCallback((next: boolean) => {
    setImmersive(next);
  }, []);

  const adjustOpacity = useCallback((delta: number) => {
    setOpacity((v) => Math.min(100, Math.max(MIN_OPACITY, v + delta)));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F11") {
        e.preventDefault();
        if (immersive) {
          handleImmersiveChange(false);
        } else {
          toggleFullscreen().catch(() => {});
        }
      }
      if (e.altKey && e.key === "ArrowUp") {
        e.preventDefault();
        adjustOpacity(OPACITY_STEP);
      }
      if (e.altKey && e.key === "ArrowDown") {
        e.preventDefault();
        adjustOpacity(-OPACITY_STEP);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [coverFileUrl, immersive, handleImmersiveChange, adjustOpacity]);

  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      setCtxMenu({ x: e.clientX, y: e.clientY });
    };
    const close = () => setCtxMenu(null);
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("click", close);
    window.addEventListener("blur", close);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("click", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  if (initialLoading) return <div className="h-screen" style={{ backgroundColor: bgColor, opacity: opacity / 100 }} />;

  return (
    <div
      className="h-screen flex flex-col overflow-hidden relative"
      style={{
        backgroundColor: bgColor,
        opacity: (bossOpacity ?? opacity) / 100,
        transition: "opacity 150ms ease",
      }}
    >
      <input
        ref={realInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleRealFile}
      />
      <input
        ref={coverInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleCoverFile}
      />
      <WindowControls fgColor={fgColor} bgColor={bgColor} fileName={showingReal ? realFileName : coverFileName} />
      <div className="flex-1 relative">
        <div className={"h-full relative " + (showingReal ? "" : "hidden")}>
          <PDFViewer fileUrl={realFileUrl} fileName={realFileName} bgColor={bgColor} fgColor={fgColor} showUI={true} active={showingReal} onBgColorChange={setBgColor} onFgColorChange={setFgColor} immersive={immersive} onImmersiveChange={handleImmersiveChange} windowOpacity={opacity} onWindowOpacityChange={setOpacity} onOpenFile={handleOpenFile} onSetCover={handleSetCover} alwaysOnTop={alwaysOnTop} onToggleAlwaysOnTop={() => setAlwaysOnTop((v) => !v)} />
        </div>
        {coverFileUrl && (
          <div className={"h-full relative " + (showingReal ? "hidden" : "")}>
             <PDFViewer fileUrl={coverFileUrl} fileName={coverFileName} bgColor={bgColor} fgColor={fgColor} showUI={false} active={!showingReal} onBgColorChange={setBgColor} onFgColorChange={setFgColor} immersive={immersive} onImmersiveChange={handleImmersiveChange} windowOpacity={opacity} onWindowOpacityChange={setOpacity} onSetCover={handleSetCover} onRemoveCover={handleRemoveCover} alwaysOnTop={alwaysOnTop} onToggleAlwaysOnTop={() => setAlwaysOnTop((v) => !v)} />
          </div>
        )}
      </div>
      {ctxMenu && (
        <div
          className="fixed z-50 min-w-36 py-1 rounded shadow-lg border border-white/10 select-none"
          style={{
            left: Math.min(ctxMenu.x, window.innerWidth - 170),
            top: Math.min(ctxMenu.y, window.innerHeight - 96),
            backgroundColor: darkenColor(bgColor),
            color: fgColor,
          }}
        >
          <button
            className="block w-full text-left px-3 py-1.5 text-xs cursor-pointer hover:opacity-80"
            style={{ color: fgColor }}
            onClick={() => { setCtxMenu(null); handleOpenFile(); }}
          >
            打开 PDF
          </button>
          <button
            className="block w-full text-left px-3 py-1.5 text-xs cursor-pointer hover:opacity-80"
            style={{ color: fgColor }}
            onClick={() => { setCtxMenu(null); handleSetCover(); }}
          >
            {coverFileUrl ? "更换掩护" : "设置掩护"}
          </button>
          {realFileUrl && (
            <button
              className="block w-full text-left px-3 py-1.5 text-xs cursor-pointer hover:opacity-80"
              style={{ color: fgColor }}
              onClick={() => { setCtxMenu(null); handleRemoveReal(); }}
            >
              移除 PDF
            </button>
          )}
          {coverFileUrl && (
            <button
              className="block w-full text-left px-3 py-1.5 text-xs cursor-pointer hover:opacity-80"
              style={{ color: fgColor }}
              onClick={() => { setCtxMenu(null); handleRemoveCover(); }}
            >
              移除掩护 PDF
            </button>
          )}
          {realFileUrl && coverFileUrl && (
            <button
              className="block w-full text-left px-3 py-1.5 text-xs cursor-pointer hover:opacity-80"
              style={{ color: fgColor }}
              onClick={() => { setCtxMenu(null); handleRemoveAll(); }}
            >
              全部移除
            </button>
          )}
        </div>
      )}
    </div>
  );
}
