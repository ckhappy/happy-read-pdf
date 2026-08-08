use std::sync::Mutex;

use tauri::{Emitter, Manager, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

struct BossKey {
    current: Mutex<Option<Shortcut>>,
}

#[tauri::command]
fn boss_hide(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[tauri::command]
fn set_boss_shortcut(app: tauri::AppHandle, state: State<BossKey>, combo: String) -> Result<(), String> {
    let new: Shortcut = combo.parse().map_err(|e| format!("无效的快捷键: {e}"))?;
    let mut guard = state.current.lock().unwrap();
    if let Some(cur) = *guard {
        if cur == new {
            return Ok(());
        }
    }
    app.global_shortcut()
        .register(new)
        .map_err(|e| format!("注册失败: {e}"))?;
    if let Some(old) = guard.replace(new) {
        let s = old.into_string();
        let _ = app.global_shortcut().unregister(s.as_str());
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if event.state != ShortcutState::Pressed {
                        return;
                    }
                    let is_boss = app
                        .state::<BossKey>()
                        .current
                        .lock()
                        .unwrap()
                        .map_or(false, |cur| cur == *shortcut);
                    if !is_boss {
                        return;
                    }
                    if let Some(window) = app.get_webview_window("main") {
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.emit("boss-pressed", ());
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("boss-restore", ());
                        }
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![boss_hide, set_boss_shortcut])
        .setup(|app| {
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .build(),
            )?;
            let default: Shortcut = "Alt+Backquote".parse().expect("valid default boss key");
            app.manage(BossKey {
                current: Mutex::new(Some(default)),
            });
            let _ = app.global_shortcut().register("Alt+Backquote");
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_shadow(false);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
