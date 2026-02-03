use serde::{Deserialize, Serialize};
use crate::tools;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::SystemTime;

#[derive(Debug, Serialize, Deserialize)]
pub struct Device {
    pub id: String,
    pub status: String,
    pub model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeviceList {
    pub devices: Vec<Device>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub model: Option<String>,
    pub brand: Option<String>,
    pub name: Option<String>,
    pub version: Option<String>,
    pub battery_level: Option<u8>,
    pub battery_status: Option<String>,
}

struct ScreenRecordSession {
    child: std::process::Child,
    remote_path: String,
    start_time: u64,
}

fn screen_recordings() -> &'static Mutex<HashMap<String, ScreenRecordSession>> {
    static STORE: OnceLock<Mutex<HashMap<String, ScreenRecordSession>>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn device_key(device_id: &Option<String>) -> String {
    device_id.clone().unwrap_or_else(|| "default".to_string())
}

fn hdc_shell(device_id: &Option<String>, args: &[&str]) -> Result<String, String> {
    use std::process::Command;

    let mut cmd = tools::command_for("hdc");
    if let Some(device) = device_id {
        cmd.args(&["-t", device]);
    }
    cmd.arg("shell");
    cmd.args(args);

    let output = cmd
        .output()
        .map_err(|e| format!("执行 hdc shell 失败: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub async fn hdc_list_targets() -> Result<DeviceList, String> {
    use std::process::Command;

    let output = tools::command_for("hdc")
        .args(&["list", "targets"])
        .output()
        .map_err(|e| format!("执行 hdc list targets 失败: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "hdc list targets 执行失败: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut devices = Vec::new();

    // 解析 hdc list targets 输出
    // 格式通常是: <device_id> <status> 或类似格式
    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() || line.to_lowercase().contains("targets") {
            continue;
        }

        let parts: Vec<&str> = line.split_whitespace().collect();
        if !parts.is_empty() {
            let id = parts[0].to_string();
            let status = if parts.iter().any(|p| p.to_lowercase().contains("offline")) {
                "offline"
            } else {
                "device"
            };
            devices.push(Device {
                id,
                status: status.to_string(),
                model: None,
            });
        }
    }

    Ok(DeviceList { devices })
}

#[tauri::command]
pub async fn hdc_device_info(device_id: Option<String>) -> Result<DeviceInfo, String> {
    let model = hdc_shell(&device_id, &["param", "get", "ro.product.model"]).ok();
    let brand = hdc_shell(&device_id, &["param", "get", "ro.product.brand"]).ok();
    let name = hdc_shell(&device_id, &["param", "get", "ro.product.name"]).ok();
    let version = hdc_shell(&device_id, &["param", "get", "ro.build.version.release"]).ok();

    let mut info = DeviceInfo {
        model,
        brand,
        name,
        version,
        battery_level: None,
        battery_status: None,
    };

    if let Ok(battery_dump) = hdc_shell(&device_id, &["hidumper", "-s", "3301"]) {
        for line in battery_dump.lines() {
            let trimmed = line.trim().to_lowercase();
            if trimmed.contains("level") {
                if let Some(value) = trimmed.split(':').nth(1) {
                    if let Ok(level) = value.trim().parse::<u8>() {
                        info.battery_level = Some(level);
                    }
                }
            }
            if trimmed.contains("status") {
                if let Some(value) = trimmed.split(':').nth(1) {
                    let status = match value.trim() {
                        "charging" => "charging",
                        "discharging" => "discharging",
                        "full" => "full",
                        _ => "unknown",
                    };
                    info.battery_status = Some(status.to_string());
                }
            }
        }
    }

    Ok(info)
}

#[tauri::command]
pub async fn hdc_install(device_id: Option<String>, app_path: String) -> Result<String, String> {
    use std::process::Command;

    let mut cmd = tools::command_for("hdc");
    
    if let Some(device) = device_id {
        cmd.args(&["-t", &device]);
    }
    
    cmd.args(&["install", &app_path]);
    
    let output = cmd
        .output()
        .map_err(|e| format!("执行 hdc install 失败: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub async fn hdc_uninstall(device_id: Option<String>, package_name: String) -> Result<String, String> {
    use std::process::Command;

    let mut cmd = tools::command_for("hdc");
    
    if let Some(device) = device_id {
        cmd.args(&["-t", &device]);
    }
    
    cmd.args(&["uninstall", &package_name]);
    
    let output = cmd
        .output()
        .map_err(|e| format!("执行 hdc uninstall 失败: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub async fn hdc_list_packages(device_id: Option<String>) -> Result<Vec<String>, String> {
    use std::process::Command;

    let mut cmd = tools::command_for("hdc");
    
    if let Some(device) = device_id {
        cmd.args(&["-t", &device]);
    }
    
    cmd.args(&["shell", "bm", "dump", "-n"]);
    
    let output = cmd
        .output()
        .map_err(|e| format!("执行 hdc shell bm dump -n 失败: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let packages: Vec<String> = stdout
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            // 解析 bm dump -n 输出，提取包名
            if line.contains(":") {
                let parts: Vec<&str> = line.split(':').collect();
                if parts.len() >= 2 {
                    let pkg = parts[0].trim();
                    if !pkg.is_empty() && pkg.contains(".") {
                        return Some(pkg.to_string());
                    }
                }
            }
            None
        })
        .collect();

    Ok(packages)
}

#[tauri::command]
pub async fn hdc_screenshot(
    device_id: Option<String>,
    output_path: Option<String>,
) -> Result<String, String> {
    use std::process::Command;

    let timestamp = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let remote_path = format!("/data/local/tmp/screenshot_{}.png", timestamp);

    // 先截图到设备
    let mut cmd = tools::command_for("hdc");
    if let Some(device) = device_id.clone() {
        cmd.args(&["-t", &device]);
    }
    cmd.args(&["shell", "snapshot_display", "-f", &remote_path]);
    
    let output = cmd
        .output()
        .map_err(|e| format!("执行 hdc shell snapshot_display 失败: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    // 确定本地输出路径
    let final_path = if let Some(path) = output_path {
        path
    } else {
        format!("screenshot_{}.png", timestamp)
    };

    // 拉取文件到本地
    let mut pull_cmd = tools::command_for("hdc");
    if let Some(device) = device_id.clone() {
        pull_cmd.args(&["-t", &device]);
    }
    pull_cmd.args(&["file", "recv", &remote_path, &final_path]);

    let pull_output = pull_cmd
        .output()
        .map_err(|e| format!("拉取截图文件失败: {}", e))?;

    if !pull_output.status.success() {
        return Err(String::from_utf8_lossy(&pull_output.stderr).to_string());
    }

    // 清理设备上的临时文件
    let mut rm_cmd = tools::command_for("hdc");
    if let Some(device) = device_id {
        rm_cmd.args(&["-t", &device]);
    }
    rm_cmd.args(&["shell", "rm", "-f", &remote_path]);
    let _ = rm_cmd.output();

    Ok(final_path)
}

#[tauri::command]
pub async fn hdc_start_screenrecord(device_id: Option<String>) -> Result<String, String> {
    use std::process::{Command, Stdio};

    let device_key = device_key(&device_id);
    let mut store = screen_recordings()
        .lock()
        .map_err(|_| "录屏状态锁定失败".to_string())?;

    if store.contains_key(&device_key) {
        return Err("当前设备正在录屏中".to_string());
    }

    let timestamp = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let remote_path = format!("/data/local/tmp/screenrecord_{}.mp4", timestamp);

    let mut cmd = tools::command_for("hdc");
    if let Some(device) = device_id.clone() {
        cmd.args(&["-t", &device]);
    }
    cmd.args(&["shell", "screenrecord", &remote_path])
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    let child = cmd
        .spawn()
        .map_err(|e| format!("启动录屏失败: {}", e))?;

    store.insert(
        device_key,
        ScreenRecordSession {
            child,
            remote_path: remote_path.clone(),
            start_time: timestamp,
        },
    );

    Ok(remote_path)
}

#[tauri::command]
pub async fn hdc_stop_screenrecord(
    device_id: Option<String>,
    output_path: Option<String>,
) -> Result<String, String> {
    use std::process::Command;

    let device_key = device_key(&device_id);
    let mut store = screen_recordings()
        .lock()
        .map_err(|_| "录屏状态锁定失败".to_string())?;

    let session = store
        .remove(&device_key)
        .ok_or_else(|| "当前设备没有正在进行的录屏".to_string())?;

    let mut child = session.child;
    let _ = child.kill();
    let _ = child.wait();

    let final_path = if let Some(path) = output_path {
        path
    } else {
        format!("screenrecord_{}.mp4", session.start_time)
    };

    // 拉取录屏文件到本地
    let mut pull_cmd = tools::command_for("hdc");
    if let Some(device) = device_id.clone() {
        pull_cmd.args(&["-t", &device]);
    }
    pull_cmd.args(&["file", "recv", &session.remote_path, &final_path]);

    let output = pull_cmd
        .output()
        .map_err(|e| format!("拉取录屏文件失败: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    // 清理设备上的临时文件
    let mut rm_cmd = tools::command_for("hdc");
    if let Some(device) = device_id {
        rm_cmd.args(&["-t", &device]);
    }
    rm_cmd.args(&["shell", "rm", "-f", &session.remote_path]);
    let _ = rm_cmd.output();

    Ok(final_path)
}

#[tauri::command]
pub async fn hdc_push_file(
    device_id: Option<String>,
    local_path: String,
    remote_path: String,
) -> Result<String, String> {
    use std::process::Command;

    let mut cmd = tools::command_for("hdc");
    if let Some(device) = device_id {
        cmd.args(&["-t", &device]);
    }
    cmd.args(&["file", "push", &local_path, &remote_path]);

    let output = cmd
        .output()
        .map_err(|e| format!("执行 hdc file push 失败: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub async fn hdc_pull_file(
    device_id: Option<String>,
    remote_path: String,
    local_path: String,
) -> Result<String, String> {
    use std::process::Command;

    let mut cmd = tools::command_for("hdc");
    if let Some(device) = device_id {
        cmd.args(&["-t", &device]);
    }
    cmd.args(&["file", "recv", &remote_path, &local_path]);

    let output = cmd
        .output()
        .map_err(|e| format!("执行 hdc file recv 失败: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub async fn hdc_push_certificate(
    device_id: Option<String>,
    cert_path: String,
    remote_dir: Option<String>,
) -> Result<String, String> {
    use std::path::Path;

    let file_name = Path::new(&cert_path)
        .file_name()
        .ok_or_else(|| "证书文件名无效".to_string())?
        .to_string_lossy()
        .to_string();
    let base_dir = remote_dir.unwrap_or_else(|| "/data/local/tmp".to_string());
    let remote_path = format!("{}/{}", base_dir.trim_end_matches('/'), file_name);

    hdc_push_file(device_id, cert_path, remote_path.clone()).await?;
    Ok(remote_path)
}

#[tauri::command]
pub async fn hdc_open_cert_installer(
    device_id: Option<String>,
    remote_path: String,
) -> Result<String, String> {
    use std::process::Command;

    // HarmonyOS 使用不同的方式打开证书安装器
    // 通过 shell 命令打开文件管理器或证书安装界面
    let mut cmd = tools::command_for("hdc");
    if let Some(device) = device_id {
        cmd.args(&["-t", &device]);
    }
    cmd.args(&["shell", "aa", "start", "-a", "ohos.settings.ability", "-b", "com.ohos.settings"]);

    let output = cmd
        .output()
        .map_err(|e| format!("打开证书安装向导失败: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        // 如果打开设置失败，至少返回成功，让用户手动操作
        Ok(format!("证书已推送到设备: {}，请手动在设备上安装", remote_path))
    }
}
