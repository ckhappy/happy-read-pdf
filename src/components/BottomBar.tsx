import ColorCustomizer from "./ColorCustomizer";
import { toggleFullscreen } from "../utils/fullscreen";

interface Props {
  pageNum: number;
  totalPages: number;
  loading: boolean;
  scale: number;
  fgColor: string;
  bgColor: string;
  isHighRes: boolean;
  rawMode: boolean;
  immersive: boolean;
  goToPage: (n: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  toggleQuality: () => void;
  onSetRawMode: (v: boolean) => void;
  onBgColorChange?: (c: string) => void;
  onFgColorChange?: (c: string) => void;
  onImmersiveChange?: (v: boolean) => void;
}

export default function BottomBar({
  pageNum, totalPages, loading, scale, fgColor, bgColor, isHighRes, rawMode, immersive,
  goToPage, zoomIn, zoomOut, toggleQuality, onSetRawMode,
  onBgColorChange, onFgColorChange, onImmersiveChange,
}: Props) {
  return (
    <div
      className="fixed bottom-2 right-6 flex items-center gap-1 z-10 flex-wrap justify-end"
      style={{ color: fgColor }}
    >
      {!immersive && loading && (
        <>
          <span className="text-xs select-none animate-pulse" style={{ color: "#22c55e", animationDelay: "0ms" }}>●</span>
          <span className="text-xs select-none animate-pulse" style={{ color: "#22c55e", animationDelay: "200ms" }}>●</span>
          <span className="text-xs select-none animate-pulse" style={{ color: "#22c55e", animationDelay: "400ms" }}>●</span>
          <span className="text-xs select-none ml-0.5" style={{ color: "#22c55e" }}>渲染中</span>
        </>
      )}
      {!immersive && (
        <>
          <button
            className="px-1.5 py-0.5 rounded text-xs disabled:opacity-40 cursor-pointer"
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
            style={{ color: fgColor + "99", borderColor: fgColor + "44" }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const v = Number((e.target as HTMLInputElement).value);
                if (v >= 1 && v <= totalPages) goToPage(v);
                (e.target as HTMLInputElement).value = "";
              }
            }}
          />
          <button
            className="px-1.5 py-0.5 rounded text-xs disabled:opacity-40 cursor-pointer"
            style={{ backgroundColor: fgColor + "22", color: fgColor }}
            disabled={pageNum >= totalPages}
            onClick={() => goToPage(pageNum + 1)}
          >
            ▶
          </button>
          <span className="text-xs select-none ml-1" style={{ color: fgColor + "99" }}>
            缩放 {Math.round(scale * 100)}%
          </span>
          <button
            className="px-1.5 py-0.5 rounded text-xs cursor-pointer"
            style={{ backgroundColor: fgColor + "22", color: fgColor }}
            onClick={zoomOut}
            title="缩小"
          >
            −
          </button>
          <button
            className="px-1.5 py-0.5 rounded text-xs cursor-pointer"
            style={{ backgroundColor: fgColor + "22", color: fgColor }}
            onClick={zoomIn}
            title="放大"
          >
            +
          </button>
          <button
            className="px-1.5 py-0.5 rounded text-xs cursor-pointer"
            style={{ backgroundColor: fgColor + "22", color: fgColor }}
            onClick={toggleQuality}
            title={isHighRes ? "切换标清渲染" : "切换高清渲染"}
          >
            {isHighRes ? "高清" : "标清"}
          </button>
          <ColorCustomizer bgColor={bgColor} fgColor={fgColor} setBgColor={onBgColorChange || (() => {})} setFgColor={onFgColorChange || (() => {})} rawMode={rawMode} onSetRawMode={onSetRawMode} />
        </>
      )}
      <button
        className="px-1.5 py-0.5 rounded text-xs cursor-pointer ml-1"
        style={{ backgroundColor: fgColor + "22", color: fgColor }}
        onClick={() => { onImmersiveChange?.(!immersive); toggleFullscreen(); }}
        title={immersive ? "退出沉浸全屏" : "沉浸全屏"}
      >
        {immersive ? "退出" : "沉浸"}
      </button>
    </div>
  );
}
