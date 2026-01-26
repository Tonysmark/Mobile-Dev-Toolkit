// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod executor;
mod adb;
mod hdc;
mod dependencies;
mod tools;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // 应用初始化逻辑
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            executor::execute_command,
            adb::adb_devices,
            adb::adb_install,
            adb::adb_uninstall,
            adb::adb_list_packages,
            adb::adb_screenshot,
            adb::adb_start_screenrecord,
            adb::adb_stop_screenrecord,
            adb::adb_push_file,
            adb::adb_pull_file,
            adb::adb_push_certificate,
            adb::adb_open_cert_installer,
            hdc::hdc_list_targets,
            hdc::hdc_install,
            hdc::hdc_uninstall,
            hdc::hdc_list_packages,
            hdc::hdc_screenshot,
            hdc::hdc_start_screenrecord,
            hdc::hdc_stop_screenrecord,
            hdc::hdc_push_file,
            hdc::hdc_pull_file,
            hdc::hdc_push_certificate,
            hdc::hdc_open_cert_installer,
            dependencies::check_dependencies,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
