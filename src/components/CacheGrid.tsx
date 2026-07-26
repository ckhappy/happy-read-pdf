import { forwardRef, useImperativeHandle, useRef, useState, useLayoutEffect, useEffect, useCallback } from "react";

const GRID_COLS = 20;
const CELL_SIZE = 8;
const GAP = 1;
const STEP = CELL_SIZE + GAP;

interface Props {
  totalPages: number;
  pageNum: number;
  fgColor: string;
  bgColor: string;
  immersive: boolean;
  showUI: boolean;
  cacheLimit: number;
  onCacheLimitChange: (v: number) => void;
  onGoToPage: (page: number) => void;
  hasPage: (page: number) => boolean;
  isPreloading: (page: number) => boolean;
}

export interface CacheGridHandle {
  drawCell: (page: number) => void;
}

export default forwardRef<CacheGridHandle, Props>(function CacheGrid({ totalPages, pageNum, fgColor, bgColor, immersive, showUI, cacheLimit, onCacheLimitChange, onGoToPage, hasPage, isPreloading }, ref) {
  const [gridVisible, setGridVisible] = useState(false);
  const cacheGridCanvasRef = useRef<HTMLCanvasElement>(null);
  const pageNumRef = useRef(pageNum);
  pageNumRef.current = pageNum;
  const hasPageRef = useRef(hasPage);
  hasPageRef.current = hasPage;
  const isPreloadingRef = useRef(isPreloading);
  isPreloadingRef.current = isPreloading;

  const drawCell = useCallback((page: number) => {
    const canvas = cacheGridCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const col = (page - 1) % GRID_COLS;
    const row = Math.floor((page - 1) / GRID_COLS);
    const x = col * STEP;
    const y = row * STEP;
    const cur = pageNumRef.current;
    if (page === cur) {
      ctx.fillStyle = "#3b82f6";
    } else if (hasPageRef.current(page)) {
      ctx.fillStyle = "#22c55e";
    } else if (isPreloadingRef.current(page)) {
      ctx.fillStyle = "#9ca3af";
    } else {
      ctx.fillStyle = "#ef4444";
    }
    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
    if (page === cur) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, CELL_SIZE - 1, CELL_SIZE - 1);
    }
  }, []);

  useImperativeHandle(ref, () => ({ drawCell }), [drawCell]);

  useLayoutEffect(() => {
    const canvas = cacheGridCanvasRef.current;
    if (!canvas || !totalPages) return;
    const cols = GRID_COLS;
    const rows = Math.ceil(totalPages / cols);
    canvas.width = cols * STEP;
    canvas.height = rows * STEP;
    canvas.style.width = (cols * STEP) + "px";
    canvas.style.height = (rows * STEP) + "px";
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    for (let i = 1; i <= totalPages; i++) {
      const col = (i - 1) % cols;
      const row = Math.floor((i - 1) / cols);
      const x = col * STEP;
      const y = row * STEP;
      const cur = pageNumRef.current;
      if (i === cur) {
        ctx.fillStyle = "#3b82f6";
      } else if (hasPageRef.current(i)) {
        ctx.fillStyle = "#22c55e";
      } else if (isPreloadingRef.current(i)) {
        ctx.fillStyle = "#9ca3af";
      } else {
        ctx.fillStyle = "#ef4444";
      }
      ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
      if (i === cur) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, CELL_SIZE - 1, CELL_SIZE - 1);
      }
    }
  }, [totalPages, gridVisible]);

  const prevPageRef = useRef(pageNum);
  useEffect(() => {
    if (prevPageRef.current !== pageNum) {
      drawCell(prevPageRef.current);
      drawCell(pageNum);
      prevPageRef.current = pageNum;
    }
  }, [pageNum, drawCell]);

  return (
    <>
      {!immersive && showUI && totalPages > 0 && (
        <button
          className="absolute top-3 right-5 z-10 text-xs cursor-pointer select-none hover:opacity-70 px-1.5 py-0.5 rounded"
          style={{ color: fgColor + "99", backgroundColor: gridVisible ? fgColor + "22" : "transparent" }}
          onClick={() => setGridVisible((v) => !v)}
          title="查看缓存状态"
        >
          {gridVisible ? "隐藏缓存" : "缓存概览"}
        </button>
      )}
      {!immersive && showUI && totalPages > 0 && gridVisible && (
        <div className="absolute right-5 top-10 z-10 flex flex-col items-end gap-0.5">
          <canvas
            ref={cacheGridCanvasRef}
            className="block cursor-pointer"
            onClick={(e) => {
              const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              const col = Math.floor(x / STEP);
              const row = Math.floor(y / STEP);
              const page = row * GRID_COLS + col + 1;
              if (page >= 1 && page <= totalPages) onGoToPage(page);
            }}
          />
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-xs select-none" style={{ color: fgColor + "aa" }}>缓存页码数量</span>
            <select
              value={String(cacheLimit)}
              onChange={(e) => {
                const v = Number(e.target.value);
                onCacheLimitChange(v);
                e.target.blur();
              }}
              className="text-xs border border-white/10 rounded px-1 py-0.5 cursor-pointer text-left"
              style={{ color: fgColor + "cc", backgroundColor: bgColor }}
            >
              <option value="-1">关闭</option>
              <option value="0">全量</option>
              <option value="10">10页</option>
              <option value="20">20页</option>
              <option value="40">40页</option>
              <option value="80">80页</option>
            </select>
          </div>
        </div>
      )}
    </>
  );
});
