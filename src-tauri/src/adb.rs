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

#[tauri::command]
pub async fn adb_devices() -> Result<DeviceList, String> {
    use std::process::Command;

    let output = tools::command_for("adb")
        .arg("devices")
        .output()
        .map_err(|e| format!("执行 adb devices 失败: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "adb devices 执行失败: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut devices = Vec::new();

    // 解析 adb devices 输出
    // 格式: List of devices attached\n<device_id>\t<status>\n...
    for line in stdout.lines().skip(1) {
        let line = line.trim();
        if line.is_empty() || line == "List of devices attached" {
            continue;
        }

        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 2 {
            devices.push(Device {
                id: parts[0].to_string(),
                status: parts[1].to_string(),
                model: None, // 可以通过 adb -s <device> shell getprop ro.product.model 获取
            });
        }
    }

    Ok(DeviceList { devices })
}

#[tauri::command]
pub async fn adb_install(device_id: Option<String>, apk_path: String) -> Result<String, String> {
    use std::process::Command;

    let mut cmd = tools::command_for("adb");
    
    if let Some(device) = device_id {
        cmd.args(&["-s", &device]);
    }
    
    cmd.args(&["install", "-r", &apk_path]);
    
    let output = cmd
        .output()
        .map_err(|e| format!("执行 adb install 失败: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub async fn adb_uninstall(device_id: Option<String>, package_name: String) -> Result<String, String> {
    use std::process::Command;

    let mut cmd = tools::command_for("adb");
    
    if let Some(device) = device_id {
        cmd.args(&["-s", &device]);
    }
    
    cmd.args(&["uninstall", &package_name]);
    
    let output = cmd
        .output()
        .map_err(|e| format!("执行 adb uninstall 失败: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub async fn adb_list_packages(device_id: Option<String>) -> Result<Vec<String>, String> {
    use std::process::Command;

    let mut cmd = tools::command_for("adb");
    
    if let Some(device) = device_id {
        cmd.args(&["-s", &device]);
    }
    
    cmd.args(&["shell", "pm", "list", "packages"]);
    
    let output = cmd
        .output()
        .map_err(|e| format!("执行 adb shell pm list packages 失败: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let packages: Vec<String> = stdout
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.starts_with("package:") {
                Some(line.replace("package:", "").trim().to_string())
            } else {
                None
            }
        })
        .collect();

    Ok(packages)
}

#[tauri::command]
pub async fn adb_screenshot(
    device_id: Option<String>,
    output_path: Option<String>,
) -> Result<String, String> {
    use std::process::Command;

    let mut cmd = tools::command_for("adb");
    
    if let Some(device) = device_id {
        cmd.args(&["-s", &device]);
    }
    
    cmd.args(&["exec-out", "screencap", "-p"]);
    
    let output = cmd
        .output()
        .map_err(|e| format!("执行 adb screencap 失败: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    // 确定输出路径
    let final_path = if let Some(path) = output_path {
        path
    } else {
        // 如果没有指定路径，使用默认路径：当前目录/screenshot_<timestamp>.png
        let timestamp = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        format!("screenshot_{}.png", timestamp)
    };

    // 将截图数据写入文件
    std::fs::write(&final_path, &output.stdout)
        .map_err(|e| format!("写入截图文件失败: {}", e))?;

    Ok(final_path)
}

#[tauri::command]
pub async fn adb_start_screenrecord(device_id: Option<String>) -> Result<String, String> {
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
    let remote_path = format!("/sdcard/screenrecord_{}.mp4", timestamp);

    let mut cmd = tools::command_for("adb");
    if let Some(device) = device_id.clone() {
        cmd.args(&["-s", &device]);
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
pub async fn adb_stop_screenrecord(
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

    let mut pull_cmd = tools::command_for("adb");
    if let Some(device) = device_id.clone() {
        pull_cmd.args(&["-s", &device]);
    }
    pull_cmd.args(&["pull", &session.remote_path, &final_path]);

    let output = pull_cmd
        .output()
        .map_err(|e| format!("拉取录屏文件失败: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let mut rm_cmd = tools::command_for("adb");
    if let Some(device) = device_id {
        rm_cmd.args(&["-s", &device]);
    }
    rm_cmd.args(&["shell", "rm", "-f", &session.remote_path]);
    let _ = rm_cmd.output();

    Ok(final_path)
}

#[tauri::command]
pub async fn adb_push_file(
    device_id: Option<String>,
    local_path: String,
    remote_path: String,
) -> Result<String, String> {
    use std::process::Command;

    let mut cmd = tools::command_for("adb");
    if let Some(device) = device_id {
        cmd.args(&["-s", &device]);
    }
    cmd.args(&["push", &local_path, &remote_path]);

    let output = cmd
        .output()
        .map_err(|e| format!("执行 adb push 失败: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub async fn adb_pull_file(
    device_id: Option<String>,
    remote_path: String,
    local_path: String,
) -> Result<String, String> {
    use std::process::Command;

    let mut cmd = tools::command_for("adb");
    if let Some(device) = device_id {
        cmd.args(&["-s", &device]);
    }
    cmd.args(&["pull", &remote_path, &local_path]);

    let output = cmd
        .output()
        .map_err(|e| format!("执行 adb pull 失败: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub async fn adb_push_certificate(
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
    let base_dir = remote_dir.unwrap_or_else(|| "/sdcard/Download".to_string());
    let remote_path = format!("{}/{}", base_dir.trim_end_matches('/'), file_name);

    adb_push_file(device_id, cert_path, remote_path.clone()).await?;
    Ok(remote_path)
}

#[tauri::command]
pub async fn adb_open_cert_installer(
    device_id: Option<String>,
    remote_path: String,
) -> Result<String, String> {
    use std::process::Command;

    let uri = format!("file://{}", remote_path);
    let mut cmd = tools::command_for("adb");
    if let Some(device) = device_id {
        cmd.args(&["-s", &device]);
    }
    cmd.args(&[
        "shell",
        "am",
        "start",
        "-a",
        "android.intent.action.VIEW",
        "-t",
        "application/x-x509-ca-cert",
        "-d",
        &uri,
    ]);

    let output = cmd
        .output()
        .map_err(|e| format!("打开证书安装向导失败: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
