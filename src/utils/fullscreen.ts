export async function toggleFullscreen(): Promise<void> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    try {
      const win = getCurrentWindow();
      const fs = await win.isFullscreen();
      await win.setFullscreen(!fs);
    } catch {}
  } else if (document.fullscreenElement) {
    await document.exitFullscreen();
  } else {
    await document.documentElement.requestFullscreen();
  }
}

export function addFullscreenListener(fn: (isFullscreen: boolean) => void): () => void {
  const handler = () => fn(!!document.fullscreenElement);

  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      getCurrentWindow().onResized(() => {
        getCurrentWindow().isFullscreen().then(fn).catch(() => {});
      });
    })();
  }

  document.addEventListener("fullscreenchange", handler);
  return () => document.removeEventListener("fullscreenchange", handler);
}
