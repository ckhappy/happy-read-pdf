import ColorCustomizer from "./ColorCustomizer";
import BossKeyButton from "./BossKeyButton";
import { darkenColor } from "../utils/colorTransform";

interface Props {
  pageNum: number;
  totalPages: number;
  loading: boolean;
  scale: number;
  fgColor: string;
  bgColor: string;
  rawMode: boolean;
  immersive: boolean;
  showUI?: boolean;
  goToPage: (n: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  onSetRawMode: (v: boolean) => void;
  onBgColorChange?: (c: string) => void;
  onFgColorChange?: (c: string) => void;
  onImmersiveChange?: (v: boolean) => void;
  windowOpacity?: number;
  onWindowOpacityChange?: (v: number) => void;
  onOpenFile?: () => void;
  onSetCover?: () => void;
  onRemoveCover?: () => void;
  alwaysOnTop?: boolean;
  onToggleAlwaysOnTop?: () => void;
  barVisible?: boolean;
}

const btnCls = "px-1.5 py-0.5 rounded text-xs cursor-pointer transition-opacity hover:opacity-80";
const btnClsDisabled = btnCls + " disabled:opacity-40";

export default function BottomBar({
  pageNum, totalPages, loading, scale, fgColor, bgColor, rawMode, immersive,
  showUI = false, goToPage, zoomIn, zoomOut, onSetRawMode,
  onBgColorChange, onFgColorChange, onImmersiveChange, windowOpacity = 100, onWindowOpacityChange,
  onOpenFile, onSetCover, onRemoveCover, alwaysOnTop = true, onToggleAlwaysOnTop, barVisible = true,
}: Props) {
  const immBtn = (
    <button
      className={btnCls + " ml-1"}
      style={{ backgroundColor: fgColor + "22", color: fgColor }}
      onClick={() => { onImmersiveChange?.(!immersive); }}
      title={immersive ? "退出沉浸全屏" : "沉浸全屏"}
    >
      {immersive ? "退出" : "沉浸"}
    </button>
  );

  const topmostBtn = onToggleAlwaysOnTop && (
    <button
      className={btnCls}
      style={{ backgroundColor: alwaysOnTop ? fgColor + "55" : fgColor + "22", color: fgColor }}
      onClick={onToggleAlwaysOnTop}
      title={alwaysOnTop ? "窗口置顶已开启，点击关闭" : "窗口置顶已关闭，点击开启"}
    >
      置顶:{alwaysOnTop ? "开" : "关"}
    </button>
  );

  if (!barVisible) return null;

  return (
    <div
      className={immersive
        ? "fixed bottom-2 right-6 flex items-center gap-1 z-10 flex-wrap justify-end"
        : "absolute bottom-0 left-0 right-0 flex items-center gap-1 flex-wrap justify-between z-10 px-3 py-1 border-t border-white/10"}
      style={{ color: fgColor, backgroundColor: immersive ? undefined : darkenColor(bgColor), opacity: immersive ? undefined : 0.85 }}
    >
      {!immersive && showUI && (
        <div className="flex items-center gap-1 min-w-0">
          {onOpenFile && (
            <button className={btnCls} style={{ backgroundColor: fgColor + "22", color: fgColor }} onClick={onOpenFile} title="打开 PDF">打开 PDF</button>
          )}
          {onSetCover && (
            <button className={btnCls} style={{ backgroundColor: fgColor + "22", color: fgColor }} onClick={onSetCover} title="更换掩护">更换掩护</button>
          )}
          <BossKeyButton fgColor={fgColor} />
          {topmostBtn}
        </div>
      )}
      {!immersive && !showUI && (
        <div className="flex items-center gap-1 min-w-0">
          {onSetCover && (
            <button className={btnCls} style={{ backgroundColor: fgColor + "22", color: fgColor }} onClick={onSetCover} title="更换掩护">更换掩护</button>
          )}
          {onRemoveCover && (
            <button className={btnCls} style={{ backgroundColor: fgColor + "22", color: fgColor }} onClick={onRemoveCover} title="移除掩护 PDF">移除掩护 PDF</button>
          )}
          <BossKeyButton fgColor={fgColor} />
          {topmostBtn}
        </div>
      )}
      {!immersive && (
        <div className="flex items-center gap-1 flex-wrap justify-end ml-auto">
          {loading && (
            <>
              <span className="text-xs select-none animate-pulse" style={{ color: "#22c55e", animationDelay: "0ms" }}>●</span>
              <span className="text-xs select-none animate-pulse" style={{ color: "#22c55e", animationDelay: "200ms" }}>●</span>
              <span className="text-xs select-none animate-pulse" style={{ color: "#22c55e", animationDelay: "400ms" }}>●</span>
              <span className="text-xs select-none ml-0.5" style={{ color: "#22c55e" }}>渲染中</span>
            </>
          )}
          <button
            className={btnClsDisabled}
            style={{ backgroundColor: fgColor + "22", color: fgColor }}
            disabled={pageNum <= 1}
            onClick={() => goToPage(pageNum - 1)}
          >
            ◀
          </button>
          <span className="text-xs select-none min-w-[4ch] text-center">
            {pageNum}/{totalPages}
          </span>
          <input
            type="number"
            min={1}
            max={totalPages}
            placeholder="跳转"
            className="w-10 h-5 text-xs bg-transparent border-b text-center outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            style={{ color: fgColor, borderColor: fgColor + "44" }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const v = Number((e.target as HTMLInputElement).value);
                if (v >= 1 && v <= totalPages) goToPage(v);
                (e.target as HTMLInputElement).value = "";
              }
            }}
          />
          <button
            className={btnClsDisabled}
            style={{ backgroundColor: fgColor + "22", color: fgColor }}
            disabled={pageNum >= totalPages}
            onClick={() => goToPage(pageNum + 1)}
          >
            ▶
          </button>
          <span className="text-xs select-none ml-1" style={{ color: fgColor }}>
            缩放 {Math.round(scale * 100)}%
          </span>
          <button
            className={btnCls}
            style={{ backgroundColor: fgColor + "22", color: fgColor }}
            onClick={zoomOut}
            title="缩小"
          >
            −
          </button>
          <button
            className={btnCls}
            style={{ backgroundColor: fgColor + "22", color: fgColor }}
            onClick={zoomIn}
            title="放大"
          >
            +
          </button>
          <ColorCustomizer bgColor={bgColor} fgColor={fgColor} setBgColor={onBgColorChange || (() => {})} setFgColor={onFgColorChange || (() => {})} rawMode={rawMode} onSetRawMode={onSetRawMode} />
          <span
            className="text-xs select-none"
            style={{ color: fgColor }}
            title="窗口透明度 (Alt+↑ / Alt+↓)"
          >
            透明 <span className="inline-block w-[3ch] text-center">{Math.round(windowOpacity)}</span>%
          </span>
          <input
            type="range"
            min={10}
            max={100}
            value={windowOpacity}
            onChange={(e) => onWindowOpacityChange?.(Number(e.target.value))}
            className="w-20 h-4 cursor-pointer"
            style={{ accentColor: fgColor }}
            title="窗口透明度"
          />
          {immBtn}
        </div>
      )}
      {immersive && immBtn}
    </div>
  );
}
