use serde::{Deserialize, Serialize};
use std::process::Command;
use crate::tools;

#[derive(Debug, Serialize, Deserialize)]
pub struct CommandOutput {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

#[tauri::command]
pub async fn execute_command(
    program: String,
    args: Vec<String>,
) -> Result<CommandOutput, String> {
    let mut cmd = match program.as_str() {
        "adb" | "hdc" | "idevice_id" | "ideviceinstaller" => tools::command_for(&program),
        _ => Command::new(&program),
    };

    let output = cmd.args(&args).output().map_err(|e| format!("执行命令失败: {}", e))?;

    Ok(CommandOutput {
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code(),
    })
}
