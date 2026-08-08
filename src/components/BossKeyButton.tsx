import { useEffect, useState } from "react";

interface Props {
  fgColor: string;
}

export const BOSS_KEY_STORAGE = "happyread-boss-key";
export const DEFAULT_BOSS_COMBO = "Alt+Backquote";

const MOD_ALIASES: Record<string, string> = {
  Alt: "Alt",
  Control: "Ctrl",
  Ctrl: "Ctrl",
  Shift: "Shift",
  Super: "Win",
  Meta: "Win",
};

const KEY_ALIASES: Record<string, string> = {
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Space: "Space",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Enter: "Enter",
  Tab: "Tab",
  Backspace: "Backspace",
  Delete: "Delete",
  Insert: "Insert",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
};

const RESERVED = new Set(["Alt+ArrowUp", "Alt+ArrowDown", "Ctrl+ArrowUp", "Ctrl+ArrowDown"]);

function loadCombo(): string {
  try { return localStorage.getItem(BOSS_KEY_STORAGE) || DEFAULT_BOSS_COMBO; } catch { return DEFAULT_BOSS_COMBO; }
}

function formatCombo(combo: string): string {
  return combo
    .split("+")
    .map((token) => {
      if (MOD_ALIASES[token]) return MOD_ALIASES[token];
      if (KEY_ALIASES[token]) return KEY_ALIASES[token];
      if (token.startsWith("Key") && token.length === 4) return token.slice(3);
      if (token.startsWith("Digit") && token.length === 6) return token.slice(5);
      return token;
    })
    .join("+");
}

function buildCombo(e: KeyboardEvent): string | null {
  const code = e.code;
  if (!code) return null;
  if (/^(Alt|Control|Shift|Meta)(Left|Right)$/.test(code)) return null;
  if (!(e.altKey || e.ctrlKey || e.metaKey)) return null;
  const mods: string[] = [];
  if (e.altKey) mods.push("Alt");
  if (e.ctrlKey) mods.push("Ctrl");
  if (e.shiftKey) mods.push("Shift");
  if (e.metaKey) mods.push("Super");
  return mods.length ? [...mods, code].join("+") : code;
}

export default function BossKeyButton({ fgColor }: Props) {
  const [combo, setCombo] = useState(() => loadCombo());
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!capturing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code === "Escape") {
        setCapturing(false);
        return;
      }
      const next = buildCombo(e);
      if (!next) return;
      if (RESERVED.has(next)) {
        setError("与现有快捷键冲突");
        return;
      }
      import("@tauri-apps/api/core").then(({ invoke }) => {
        invoke("set_boss_shortcut", { combo: next })
          .then(() => {
            try { localStorage.setItem(BOSS_KEY_STORAGE, next); } catch {}
            setCombo(next);
            setCapturing(false);
            setError(null);
          })
          .catch((err) => {
            setError(String(err ?? "注册失败"));
          });
      });
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [capturing]);

  const btnCls = "px-1.5 py-0.5 rounded text-xs cursor-pointer transition-opacity hover:opacity-80";

  return (
    <>
      <button
        className={btnCls}
        style={{ backgroundColor: fgColor + "22", color: fgColor }}
        onClick={() => { setError(null); setCapturing(true); }}
        title={capturing ? "按下新的组合键，Esc 取消" : "点击自定义老板键"}
      >
        {capturing ? "按下组合键 (Esc 取消)" : `Boss: ${formatCombo(combo)}`}
      </button>
      {error && (
        <span className="text-xs select-none" style={{ color: "#f87171" }} title={error}>
          {error}
        </span>
      )}
    </>
  );
}
