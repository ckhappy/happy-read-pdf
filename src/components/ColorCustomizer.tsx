const THEMES = [
  { name: "原始", bg: "", fg: "" },
  { name: "暗色", bg: "#1e1e2e", fg: "#cdd6f4" },
  { name: "羊皮纸", bg: "#f4ecd8", fg: "#5b4636" },
  { name: "白色", bg: "#ffffff", fg: "#000000" },
  { name: "深紫", bg: "#1a1a2e", fg: "#00ff88" },
];

interface Props {
  bgColor: string;
  fgColor: string;
  setBgColor: (c: string) => void;
  setFgColor: (c: string) => void;
  rawMode?: boolean;
  onSetRawMode?: (v: boolean) => void;
}

export default function ColorCustomizer({ bgColor, fgColor, setBgColor, setFgColor, rawMode, onSetRawMode }: Props) {
  const hasRaw = rawMode !== undefined && onSetRawMode !== undefined;
  const currentTheme = THEMES.find((t) => t.name !== "原始" && t.bg === bgColor && t.fg === fgColor)?.name;

  return (
    <div className="flex items-center gap-1.5" style={{ color: fgColor }}>
      <span className="text-xs select-none" style={{ color: fgColor + "aa" }}>主题</span>
      <select
        value={hasRaw && rawMode ? "原始" : (currentTheme || "")}
        onChange={(e) => {
          if (hasRaw && e.target.value === "原始") {
            onSetRawMode!(true);
          } else {
            const t = THEMES.find((x) => x.name === e.target.value);
            if (t) { onSetRawMode?.(false); setBgColor(t.bg); setFgColor(t.fg); }
          }
          e.target.blur();
        }}
        className="text-xs border cursor-pointer rounded px-1 py-0.5"
        style={{ color: fgColor + "cc", backgroundColor: bgColor, borderColor: fgColor + "33" }}
      >
        {THEMES.filter((t) => hasRaw || t.name !== "原始").map((t) => (
          <option key={t.name} value={t.name}>{t.name}</option>
        ))}
      </select>
      <span className="text-xs select-none ml-1" style={{ color: fgColor + "aa" }}>背景</span>
      <label className="flex items-center">
        <input
          type="color"
          value={bgColor}
          onChange={(e) => setBgColor(e.target.value)}
          className="w-6 h-6 rounded cursor-pointer border-0 p-0"
        />
      </label>
      <span className="text-xs select-none" style={{ color: fgColor + "aa" }}>文字</span>
      <label className="flex items-center">
        <input
          type="color"
          value={fgColor}
          onChange={(e) => setFgColor(e.target.value)}
          className="w-6 h-6 rounded cursor-pointer border-0 p-0"
        />
      </label>
    </div>
  );
}
