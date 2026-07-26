import { useState, useCallback, useRef, useEffect } from "react";
import Toolbar from "./components/Toolbar";
import PDFViewer from "./components/PDFViewer";
import { savePDFCache, loadPDFCache } from "./utils/pdfCache";
import { toggleFullscreen } from "./utils/fullscreen";
import "./index.css";

function loadColor(key: string, fallback: string): string {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}

export default function App() {
  const [realFileUrl, setRealFileUrl] = useState("");
  const [realFileName, setRealFileName] = useState("");
  const [coverFileUrl, setCoverFileUrl] = useState("");
  const [coverFileName, setCoverFileName] = useState("");
  const [showingReal, setShowingReal] = useState(true);
  const [bgColor, setBgColor] = useState(() => loadColor("happyread-bg", "#1e1e2e"));
  const [fgColor, setFgColor] = useState(() => loadColor("happyread-fg", "#cdd6f4"));
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => { localStorage.setItem("happyread-bg", bgColor); }, [bgColor]);
  useEffect(() => { localStorage.setItem("happyread-fg", fgColor); }, [fgColor]);

  const [showToolbar, setShowToolbar] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const realInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const realFileUrlRef = useRef(realFileUrl);
  realFileUrlRef.current = realFileUrl;

  useEffect(() => {
    (async () => {
      const [real, cover] = await Promise.all([loadPDFCache("real"), loadPDFCache("cover")]);
      if (real) {
        const blob = new Blob([real.data]);
        setRealFileUrl(URL.createObjectURL(blob));
        setRealFileName(real.fileName);
        setShowToolbar(false);
      }
      if (cover) {
        const blob = new Blob([cover.data]);
        setCoverFileUrl(URL.createObjectURL(blob));
        setCoverFileName(cover.fileName);
      }
      setInitialLoading(false);
    })();
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
    setShowToolbar(false);
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

  const handleToggleFullscreen = useCallback(() => {
    toggleFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "`") {
        e.preventDefault();
        if (!coverFileUrl) return;
        setShowingReal((v) => !v);
      }
      if (e.key === "F11") {
        e.preventDefault();
        toggleFullscreen().catch(() => {});
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [coverFileUrl]);

  if (initialLoading) return <div className="h-screen" style={{ backgroundColor: bgColor }} />;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: bgColor }}>
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
      {showingReal && (
        <Toolbar
          fileName={realFileName}
          onOpenFile={handleOpenFile} onSetCover={handleSetCover}
          hasCover={!!coverFileUrl} showingReal={true}
          open={showToolbar}
          onToggle={() => setShowToolbar((v) => !v)}
          hidden={immersive}
          onFullscreen={handleToggleFullscreen}
        />
      )}
      <div className="flex-1 relative">
        <div className={"h-full relative " + (showingReal ? "" : "hidden")}>
          <PDFViewer fileUrl={realFileUrl} fileName={realFileName} bgColor={bgColor} fgColor={fgColor} showUI={true} active={showingReal} onBgColorChange={setBgColor} onFgColorChange={setFgColor} immersive={immersive} onImmersiveChange={setImmersive} />
        </div>
        {coverFileUrl && (
          <div className={"h-full relative " + (showingReal ? "hidden" : "")}>
             <PDFViewer fileUrl={coverFileUrl} fileName={coverFileName} bgColor={bgColor} fgColor={fgColor} showUI={false} active={!showingReal} onBgColorChange={setBgColor} onFgColorChange={setFgColor} immersive={immersive} onImmersiveChange={setImmersive} />
          </div>
        )}
      </div>
    </div>
  );
}
