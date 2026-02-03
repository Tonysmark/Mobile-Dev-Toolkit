use serde::{Deserialize, Serialize};
use crate::tools;
use crossbeam_channel::Sender;
use std::collections::HashMap;
use std::io::Read;
use std::net::{TcpListener, TcpStream};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex, OnceLock,
};
use std::thread;
use std::time::{Duration, SystemTime};
use tungstenite::Message;

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

struct MirrorStreamSession {
    child: std::process::Child,
    device_id: Option<String>,
    forward_port: u16,
    stop_flag: Arc<AtomicBool>,
    clients: Arc<Mutex<Vec<Sender<Vec<u8>>>>>,
    url: String,
}

fn screen_recordings() -> &'static Mutex<HashMap<String, ScreenRecordSession>> {
    static STORE: OnceLock<Mutex<HashMap<String, ScreenRecordSession>>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn mirror_streams() -> &'static Mutex<HashMap<String, MirrorStreamSession>> {
    static STORE: OnceLock<Mutex<HashMap<String, MirrorStreamSession>>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn device_key(device_id: &Option<String>) -> String {
    device_id.clone().unwrap_or_else(|| "default".to_string())
}

fn adb_shell(device_id: &Option<String>, args: &[&str]) -> Result<String, String> {
    use std::process::Command;

    let mut cmd = tools::command_for("adb");
    if let Some(device) = device_id {
        cmd.args(&["-s", device]);
    }
    cmd.arg("shell");
    cmd.args(args);

    let output = cmd
        .output()
        .map_err(|e| format!("执行 adb shell 失败: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MirrorStreamInfo {
    pub url: String,
}

fn resolve_scrcpy_server_path() -> Option<std::path::PathBuf> {
    if let Ok(path) = std::env::var("MDT_SCRCPY_SERVER_PATH") {
        let candidate = std::path::PathBuf::from(path);
        if candidate.exists() {
            return Some(candidate);
        }
    }
    if let Ok(path) = std::env::var("SCRCPY_SERVER_PATH") {
        let candidate = std::path::PathBuf::from(path);
        if candidate.exists() {
            return Some(candidate);
        }
    }

    let candidates = [
        "/opt/homebrew/share/scrcpy/scrcpy-server",
        "/usr/local/share/scrcpy/scrcpy-server",
        "/usr/share/scrcpy/scrcpy-server",
    ];
    for path in candidates {
        let candidate = std::path::PathBuf::from(path);
        if candidate.exists() {
            return Some(candidate);
        }
    }

    if let Some(scrcpy_path) = tools::resolve_tool_path("scrcpy") {
        if let Some(prefix) = scrcpy_path.parent().and_then(|p| p.parent()) {
            let candidate = prefix.join("share").join("scrcpy").join("scrcpy-server");
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    None
}

fn resolve_scrcpy_version() -> Option<String> {
    if let Ok(version) = std::env::var("MDT_SCRCPY_SERVER_VERSION") {
        let trimmed = version.trim().to_string();
        if !trimmed.is_empty() {
            return Some(trimmed);
        }
    }

    let output = tools::command_for("scrcpy").arg("--version").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let line = stdout.lines().next()?.trim();
    let mut parts = line.split_whitespace();
    let first = parts.next()?;
    if first != "scrcpy" {
        return None;
    }
    let version = parts.next()?.trim();
    if version.is_empty() {
        return None;
    }
    Some(version.to_string())
}

fn pick_free_port() -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("分配本地端口失败: {}", e))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("获取本地端口失败: {}", e))?
        .port();
    Ok(port)
}

fn connect_with_retry(port: u16, stop_flag: &Arc<AtomicBool>) -> Result<TcpStream, String> {
    let addr = format!("127.0.0.1:{}", port);
    for _ in 0..30 {
        if stop_flag.load(Ordering::SeqCst) {
            return Err("镜像连接被终止".to_string());
        }
        match TcpStream::connect(&addr) {
            Ok(stream) => return Ok(stream),
            Err(_) => thread::sleep(Duration::from_millis(100)),
        }
    }
    Err("连接 scrcpy 镜像流失败".to_string())
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
pub async fn adb_device_info(device_id: Option<String>) -> Result<DeviceInfo, String> {
    let model = adb_shell(&device_id, &["getprop", "ro.product.model"]).ok();
    let brand = adb_shell(&device_id, &["getprop", "ro.product.brand"]).ok();
    let name = adb_shell(&device_id, &["getprop", "ro.product.name"]).ok();
    let version = adb_shell(&device_id, &["getprop", "ro.build.version.release"]).ok();

    let mut info = DeviceInfo {
        model,
        brand,
        name,
        version,
        battery_level: None,
        battery_status: None,
    };

    if let Ok(battery_dump) = adb_shell(&device_id, &["dumpsys", "battery"]) {
        for line in battery_dump.lines() {
            let trimmed = line.trim();
            if let Some(value) = trimmed.strip_prefix("level:") {
                if let Ok(level) = value.trim().parse::<u8>() {
                    info.battery_level = Some(level);
                }
            }
            if let Some(value) = trimmed.strip_prefix("status:") {
                let status = match value.trim() {
                    "2" => "charging",
                    "3" => "discharging",
                    "4" => "discharging",
                    "5" => "full",
                    _ => "unknown",
                };
                info.battery_status = Some(status.to_string());
            }
        }
    }

    Ok(info)
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
pub async fn adb_start_mirror(device_id: Option<String>) -> Result<MirrorStreamInfo, String> {
    use std::process::Stdio;

    let device_key = device_key(&device_id);
    let mut store = mirror_streams()
        .lock()
        .map_err(|_| "镜像状态锁定失败".to_string())?;

    if store.contains_key(&device_key) {
        let existing = store.get(&device_key).map(|s| s.url.clone());
        if let Some(url) = existing {
            return Ok(MirrorStreamInfo { url });
        }
        return Err("当前设备镜像已启动".to_string());
    }

    let server_path = resolve_scrcpy_server_path()
        .ok_or_else(|| "未找到 scrcpy-server，请安装 scrcpy 或设置 MDT_SCRCPY_SERVER_PATH".to_string())?;
    let server_version = resolve_scrcpy_version().unwrap_or_else(|| "3.3.4".to_string());

    let mut push_cmd = tools::command_for("adb");
    if let Some(device) = device_id.clone() {
        push_cmd.args(&["-s", &device]);
    }
    push_cmd
        .args(&["push", server_path.to_str().unwrap(), "/data/local/tmp/scrcpy-server.jar"]);
    let output = push_cmd
        .output()
        .map_err(|e| format!("推送 scrcpy-server 失败: {}", e))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let forward_port = pick_free_port()?;
    let mut forward_cmd = tools::command_for("adb");
    if let Some(device) = device_id.clone() {
        forward_cmd.args(&["-s", &device]);
    }
    forward_cmd.args(&[
        "forward",
        &format!("tcp:{}", forward_port),
        "localabstract:scrcpy",
    ]);
    let output = forward_cmd
        .output()
        .map_err(|e| format!("建立 adb forward 失败: {}", e))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let mut cmd = tools::command_for("adb");
    if let Some(device) = device_id.clone() {
        cmd.args(&["-s", &device]);
    }
    cmd.args(&[
        "shell",
        "CLASSPATH=/data/local/tmp/scrcpy-server.jar",
        "app_process",
        "/",
        "com.genymobile.scrcpy.Server",
        &server_version,
        "tunnel_forward=true",
        "audio=false",
        "control=false",
        "max_size=1920",
        "max_fps=60",
        "video_codec=h264",
        "send_device_meta=false",
        "send_frame_meta=false",
        "send_codec_meta=false",
        "send_dummy_byte=false",
        "raw_stream=true",
        "cleanup=false",
    ])
    .stdout(Stdio::null())
    .stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("启动 scrcpy server 失败: {}", e))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "无法获取 scrcpy server 错误输出".to_string())?;

    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("启动镜像服务失败: {}", e))?;
    listener
        .set_nonblocking(true)
        .map_err(|e| format!("设置镜像服务失败: {}", e))?;
    let addr = listener
        .local_addr()
        .map_err(|e| format!("获取镜像服务地址失败: {}", e))?;
    let url = format!("ws://127.0.0.1:{}/mirror", addr.port());

    let stop_flag = Arc::new(AtomicBool::new(false));
    let clients: Arc<Mutex<Vec<Sender<Vec<u8>>>>> = Arc::new(Mutex::new(Vec::new()));
    let prebuffer: Arc<Mutex<Vec<u8>>> = Arc::new(Mutex::new(Vec::new()));
    let prebuffer_limit = 2 * 1024 * 1024;

    let stop_flag_reader = stop_flag.clone();
    let clients_reader = clients.clone();
    let prebuffer_reader = prebuffer.clone();
    thread::spawn(move || {
        let mut stream = match connect_with_retry(forward_port, &stop_flag_reader) {
            Ok(stream) => stream,
            Err(err) => {
                println!("[mirror] scrcpy stream connect failed: {}", err);
                return;
            }
        };
        let mut buf = [0u8; 16 * 1024];
        let mut logged = false;
        while !stop_flag_reader.load(Ordering::SeqCst) {
            match stream.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    if !logged {
                        println!("[mirror] scrcpy stream started, first chunk {} bytes", n);
                        logged = true;
                    }
                    let chunk = buf[..n].to_vec();
                    if let Ok(mut cache) = prebuffer_reader.lock() {
                        cache.extend_from_slice(&chunk);
                        if cache.len() > prebuffer_limit {
                            let excess = cache.len() - prebuffer_limit;
                            cache.drain(0..excess);
                        }
                    }
                    let mut list = match clients_reader.lock() {
                        Ok(list) => list,
                        Err(_) => break,
                    };
                    list.retain(|tx| tx.send(chunk.clone()).is_ok());
                }
                Err(_) => break,
            }
        }
    });

    thread::spawn(move || {
        let mut reader = stderr;
        let mut buf = [0u8; 8 * 1024];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let output = String::from_utf8_lossy(&buf[..n]);
                    let content = output.trim();
                    if !content.is_empty() {
                        println!("[mirror][scrcpy] {}", content);
                    }
                }
                Err(_) => break,
            }
        }
    });

    let stop_flag_server = stop_flag.clone();
    let clients_server = clients.clone();
    let prebuffer_server = prebuffer.clone();
    thread::spawn(move || {
        while !stop_flag_server.load(Ordering::SeqCst) {
            match listener.accept() {
                Ok((stream, _)) => {
                    let _ = stream.set_nonblocking(false);
                    let websocket = tungstenite::accept(stream);
                    if websocket.is_err() {
                        continue;
                    }
                    let mut websocket = websocket.unwrap();
                    let (tx, rx) = crossbeam_channel::unbounded::<Vec<u8>>();
                    if let Ok(mut list) = clients_server.lock() {
                        list.push(tx);
                    }
                    let stop_flag_client = stop_flag_server.clone();
                    let initial = prebuffer_server
                        .lock()
                        .map(|cache| cache.clone())
                        .unwrap_or_default();
                    thread::spawn(move || {
                        if initial.is_empty() {
                            println!("[mirror] client connected, prebuffer empty");
                        } else {
                            println!(
                                "[mirror] client connected, prebuffer {} bytes",
                                initial.len()
                            );
                        }
                        if !initial.is_empty() {
                            let _ = websocket.write_message(Message::Binary(initial));
                        }
                        while !stop_flag_client.load(Ordering::SeqCst) {
                            match rx.recv_timeout(Duration::from_millis(200)) {
                                Ok(chunk) => {
                                    if websocket
                                        .write_message(Message::Binary(chunk))
                                        .is_err()
                                    {
                                        break;
                                    }
                                }
                                Err(crossbeam_channel::RecvTimeoutError::Timeout) => continue,
                                Err(_) => break,
                            }
                        }
                        let _ = websocket.close(None);
                    });
                }
                Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(100));
                }
                Err(_) => break,
            }
        }
    });

    store.insert(
        device_key,
        MirrorStreamSession {
            child,
            device_id: device_id.clone(),
            forward_port,
            stop_flag,
            clients,
            url: url.clone(),
        },
    );

    Ok(MirrorStreamInfo { url })
}

#[tauri::command]
pub async fn adb_stop_mirror(device_id: Option<String>) -> Result<(), String> {
    let device_key = device_key(&device_id);
    let mut store = mirror_streams()
        .lock()
        .map_err(|_| "镜像状态锁定失败".to_string())?;

    let session = store
        .remove(&device_key)
        .ok_or_else(|| "当前设备没有正在进行的镜像".to_string())?;

    session.stop_flag.store(true, Ordering::SeqCst);
    if let Ok(mut list) = session.clients.lock() {
        list.clear();
    }

    let mut forward_remove = tools::command_for("adb");
    if let Some(device) = &session.device_id {
        forward_remove.args(&["-s", device]);
    }
    forward_remove.args(&["forward", "--remove", &format!("tcp:{}", session.forward_port)]);
    let _ = forward_remove.output();

    let mut child = session.child;
    let _ = child.kill();
    let _ = child.wait();

    Ok(())
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
