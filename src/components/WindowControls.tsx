import { useEffect, useState } from "react";
import { darkenColor } from "../utils/colorTransform";

interface Props {
  fgColor: string;
  bgColor: string;
  fileName?: string;
}

export default function WindowControls({ fgColor, bgColor, fileName }: Props) {
  const [hovered, setHovered] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const tauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  useEffect(() => {
    if (!tauri) return;
    let unlisten: (() => void) | undefined;
    import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      const win = getCurrentWindow();
      win.isMaximized().then(setMaximized).catch(() => {});
      win.onResized(() => {
        win.isMaximized().then(setMaximized).catch(() => {});
      }).then((u) => { unlisten = u; }).catch(() => {});
    }).catch(() => {});
    return () => { unlisten?.(); };
  }, [tauri]);

  const handleMinimize = () => {
    if (!tauri) return;
    import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      getCurrentWindow().minimize().catch(() => {});
    }).catch(() => {});
  };

  const handleMaxToggle = () => {
    if (!tauri) return;
    import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      const w = getCurrentWindow();
      if (maximized) {
        w.unmaximize().catch(() => {});
      } else {
        w.maximize().catch(() => {});
      }
    }).catch(() => {});
  };

  const handleClose = () => {
    if (!tauri) return;
    import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      getCurrentWindow().close().catch(() => {});
    }).catch(() => {});
  };

  const btnCls = "flex items-center justify-center w-10 h-7 text-xs cursor-pointer hover:opacity-80 transition-opacity select-none";

  return (
    <div
      className="absolute top-0 left-0 right-0 z-10 flex items-center select-none transition-opacity duration-150"
      style={{ backgroundColor: darkenColor(bgColor), opacity: hovered ? 0.85 : 0 }}
      data-tauri-drag-region
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex-1 self-stretch flex items-center min-w-0" data-tauri-drag-region title="拖动窗口">
        {fileName && <span className="text-xs select-none truncate px-2" style={{ color: fgColor }}>📖 {fileName}</span>}
      </div>
      <button className={btnCls} style={{ color: fgColor }} onClick={handleMinimize} title="最小化">─</button>
      <button className={btnCls} style={{ color: fgColor }} onClick={handleMaxToggle} title={maximized ? "还原" : "最大化"}>{maximized ? "❐" : "▢"}</button>
      <button className={btnCls} style={{ color: fgColor }} onClick={handleClose} title="关闭">✕</button>
    </div>
  );
}
