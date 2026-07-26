interface Props {
  fileName: string;
  onOpenFile: () => void;
  onSetCover: () => void;
  hasCover: boolean;
  showingReal: boolean;
  open: boolean;
  onToggle: () => void;
  hidden?: boolean;
  onFullscreen?: () => void;
}

export default function Toolbar({ fileName, onOpenFile, onSetCover, hasCover, showingReal, open, onToggle, hidden, onFullscreen }: Props) {

  const hideCls = hidden ? "opacity-0 pointer-events-none" : "";

  return (
    <>
      {open ? (
        <div
          className={"flex items-center justify-between px-4 py-2 border-b border-gray-600 select-none bg-gray-900 " + hideCls}
          onClick={(e) => { if (e.target === e.currentTarget) onToggle(); }}
        >
          <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => { e.stopPropagation(); onOpenFile(); }}
              className="px-3 py-1 border border-gray-600 rounded text-sm cursor-pointer text-gray-200 bg-white/10"
            >
              打开 PDF
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onSetCover(); }}
              className="px-3 py-1 border border-gray-600 rounded text-sm cursor-pointer text-gray-400 bg-white/10"
            >
              {hasCover ? "更换掩护" : "设置掩护"}
            </button>
            <span className={"text-sm max-w-40 truncate " + (showingReal ? "text-gray-200" : "text-gray-400")}>
              {showingReal ? "📖 " + fileName : "🛡️ " + fileName}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {onFullscreen && (
              <button
                onClick={(e) => { e.stopPropagation(); onFullscreen(); }}
                className="cursor-pointer text-gray-200"
                title="全屏 (F11)"
              >
                ⛶
              </button>
            )}
            <span className={hasCover ? (showingReal ? "text-gray-400" : "text-gray-200") : "text-gray-400"}>
              Boss: Alt+`{hasCover ? (showingReal ? " (掩护中)" : " (原文件)") : ""}&nbsp;
            </span>
            <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="cursor-pointer text-gray-200">▲</button>
          </div>
        </div>
      ) : (
        <div
          className={"flex items-center justify-center py-0.5 border-b border-gray-600 select-none cursor-pointer bg-gray-900 " + hideCls}
          onClick={onToggle}
        >
          <span className="text-xs text-gray-400">▼</span>
        </div>
      )}
    </>
  );
}
