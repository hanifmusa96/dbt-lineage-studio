use std::{
  collections::HashMap,
  path::{Path, PathBuf},
  sync::{atomic::{AtomicU64, Ordering}, Mutex},
};
use tauri::{ipc::Response, AppHandle, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
struct Projects {
  next_id: AtomicU64,
  roots: Mutex<HashMap<u64, PathBuf>>,
}

#[tauri::command]
async fn choose_project(app: AppHandle, projects: State<'_, Projects>) -> Result<Option<(u64, String)>, String> {
  let Some(selected) = app.dialog().file().blocking_pick_folder() else {
    return Ok(None);
  };
  let path = selected.into_path().map_err(|error| error.to_string())?;
  let root = path.canonicalize().map_err(|error| format!("Could not open the project folder: {error}"))?;
  if !root.is_dir() {
    return Err("The selected project is not a directory.".into());
  }
  let id = projects.next_id.fetch_add(1, Ordering::Relaxed);
  projects.roots.lock().map_err(|error| error.to_string())?.insert(id, root.clone());
  Ok(Some((id, root.to_string_lossy().into_owned())))
}

fn project_file(root: &Path, path: &str) -> Result<Option<PathBuf>, String> {
  let normalized = path.replace('\\', "/");
  if normalized.is_empty() || normalized.split('/').any(|part| {
    part.is_empty() || part == "." || part == ".." || part.contains(':') || part.contains('\0')
  }) {
    return Err("The project file path is invalid or outside the selected project.".into());
  }
  let candidate = root.join(normalized);
  let file = match candidate.canonicalize() {
    Ok(file) => file,
    Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
      match candidate.symlink_metadata() {
        Err(missing) if missing.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(other) => return Err(format!("Could not read {path} in the selected project: {other}")),
        Ok(_) => return Err(format!("Could not read {path} in the selected project: {error}")),
      }
    },
    Err(error) => return Err(format!("Could not read {path} in the selected project: {error}")),
  };
  if !file.starts_with(root) {
    return Err("The project file resolves outside the selected project.".into());
  }
  Ok(Some(file))
}

fn selected_project_file(project_id: u64, path: &str, projects: &Projects) -> Result<Option<PathBuf>, String> {
  let root = projects.roots.lock().map_err(|error| error.to_string())?
    .get(&project_id).cloned().ok_or("The selected project is no longer available.")?;
  project_file(&root, path)
}

#[tauri::command]
async fn project_file_exists(project_id: u64, path: String, projects: State<'_, Projects>) -> Result<bool, String> {
  Ok(selected_project_file(project_id, &path, &projects)?.is_some())
}

#[tauri::command]
async fn read_project_file(project_id: u64, path: String, projects: State<'_, Projects>) -> Result<Response, String> {
  let file = selected_project_file(project_id, &path, &projects)?
    .ok_or_else(|| format!("Could not find {path} in the selected project."))?;
  let bytes = std::fs::read(file).map_err(|error| format!("Could not read {path}: {error}"))?;
  Ok(Response::new(bytes))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn project_paths_reject_escapes() {
    let root = Path::new("/project");
    for path in ["../secret", "a/../secret", "/absolute", "C:\\secret", "\\\\server\\share", "a//b", "a\0b"] {
      assert!(project_file(root, path).unwrap_err().contains("invalid"), "accepted {path}");
    }
  }

  #[cfg(unix)]
  #[test]
  fn project_paths_reject_symlinks_outside_the_root() {
    use std::{os::unix::fs::symlink, time::{SystemTime, UNIX_EPOCH}};
    let suffix = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let temp = std::env::temp_dir().join(format!("lineage-project-test-{}-{suffix}", std::process::id()));
    std::fs::create_dir(&temp).unwrap();
    let root = temp.join("project");
    std::fs::create_dir(&root).unwrap();
    std::fs::write(root.join("model.sql"), "select 1").unwrap();
    std::fs::write(temp.join("outside.sql"), "secret").unwrap();
    symlink(temp.join("outside.sql"), root.join("escape.sql")).unwrap();
    symlink(temp.join("missing.sql"), root.join("broken.sql")).unwrap();
    let root = root.canonicalize().unwrap();
    assert_eq!(project_file(&root, "model.sql").unwrap(), Some(root.join("model.sql")));
    assert_eq!(project_file(&root, "missing.sql").unwrap(), None);
    assert!(project_file(&root, "escape.sql").is_err());
    assert!(project_file(&root, "broken.sql").is_err());
    std::fs::remove_dir_all(temp).unwrap();
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(Projects::default())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![choose_project, project_file_exists, read_project_file])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
