use serde::{Deserialize, Serialize};
use std::process::Command;
use crate::tools;

#[derive(Debug, Serialize, Deserialize)]
pub struct DependencyInfo {
    pub name: String,
    pub display_name: String,
    pub status: String, // "available" | "unavailable" | "checking" | "unknown"
    pub version: Option<String>,
    pub error: Option<String>,
    pub path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DependenciesStatus {
    pub adb: Option<DependencyInfo>,
    pub hdc: Option<DependencyInfo>,
    pub idevice: Option<DependencyInfo>,
}

/// 检测命令是否可用并获取版本信息
fn check_command(command: &str, version_args: &[&str]) -> DependencyInfo {
    let display_name = match command {
        "adb" => "Android Debug Bridge",
        "hdc" => "HarmonyOS Debug Client",
        "idevice_id" => "iOS Device Tools",
        _ => command,
    };

    let path = match tools::resolve_tool_path(command) {
        Some(path) => path.to_string_lossy().to_string(),
        None => {
            return DependencyInfo {
                name: command.to_string(),
                display_name: display_name.to_string(),
                status: "unavailable".to_string(),
                version: None,
                error: Some(format!("命令 '{}' 未找到", command)),
                path: None,
            };
        }
    };

    // 尝试获取版本信息
    let version_output = Command::new(&path)
        .args(version_args)
        .output();

    let (version, error) = match version_output {
        Ok(output) if output.status.success() => {
            let version_text = String::from_utf8_lossy(&output.stdout);
            // 尝试提取版本号（简单实现，可根据实际情况调整）
            let version = version_text
                .lines()
                .next()
                .and_then(|line| {
                    // 查找版本号模式，如 "1.0.41" 或 "version 1.0.41"
                    line.split_whitespace()
                        .find(|s| s.chars().any(|c| c.is_ascii_digit()))
                        .map(|s| s.trim().to_string())
                });
            (version, None)
        }
        Ok(output) => {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            (None, Some(error_msg.trim().to_string()))
        }
        Err(e) => {
            (None, Some(format!("执行命令失败: {}", e)))
        }
    };

    DependencyInfo {
        name: command.to_string(),
        display_name: display_name.to_string(),
        status: if error.is_none() { "available".to_string() } else { "unavailable".to_string() },
        version,
        error,
        path: Some(path),
    }
}

#[tauri::command]
pub async fn check_dependencies() -> Result<DependenciesStatus, String> {
    // 检测 adb
    let adb = Some(check_command("adb", &["version"]));

    // 检测 hdc
    let hdc = Some(check_command("hdc", &["-v"]));

    // 检测 iOS 设备工具（idevice_id 是 idevice 工具集的一部分）
    let idevice = Some(check_command("idevice_id", &["-l"]));

    Ok(DependenciesStatus {
        adb,
        hdc,
        idevice,
    })
}
