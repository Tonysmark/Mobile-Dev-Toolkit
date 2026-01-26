use std::env;
use std::path::PathBuf;
use std::process::Command;

fn tool_filename(tool: &str) -> String {
    if cfg!(target_os = "windows") {
        format!("{}.exe", tool)
    } else {
        tool.to_string()
    }
}

fn env_override(tool: &str) -> Option<PathBuf> {
    let key = format!("MDT_{}_PATH", tool.to_uppercase().replace('-', "_"));
    let value = env::var(key).ok()?;
    let path = PathBuf::from(value);
    if path.exists() {
        Some(path)
    } else {
        None
    }
}

fn bundled_tool_candidates(tool: &str) -> Vec<PathBuf> {
    let tool_name = tool_filename(tool);
    let mut candidates = Vec::new();

    if let Ok(dir) = env::var("MDT_BUNDLED_TOOLS_DIR") {
        candidates.push(PathBuf::from(dir).join(&tool_name));
    }

    if let Ok(exe) = env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            // 开发或便携模式：与可执行文件同级的 tools 目录
            candidates.push(exe_dir.join("tools").join(&tool_name));

            // macOS App Bundle：Contents/Resources/tools
            if let Some(contents_dir) = exe_dir.parent() {
                candidates.push(contents_dir.join("Resources").join("tools").join(&tool_name));
                candidates.push(contents_dir.join("resources").join("tools").join(&tool_name));
            }
        }
    }

    candidates
}

fn find_in_path(tool: &str) -> Option<PathBuf> {
    let which_output = if cfg!(target_os = "windows") {
        Command::new("where").arg(tool).output()
    } else {
        Command::new("which").arg(tool).output()
    };

    match which_output {
        Ok(output) if output.status.success() => {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if path.is_empty() {
                None
            } else {
                Some(PathBuf::from(path))
            }
        }
        _ => None,
    }
}

pub fn resolve_tool_path(tool: &str) -> Option<PathBuf> {
    if let Some(path) = env_override(tool) {
        return Some(path);
    }

    for candidate in bundled_tool_candidates(tool) {
        if candidate.exists() {
            return Some(candidate);
        }
    }

    find_in_path(tool)
}

pub fn command_for(tool: &str) -> Command {
    if let Some(path) = resolve_tool_path(tool) {
        Command::new(path)
    } else {
        Command::new(tool)
    }
}

