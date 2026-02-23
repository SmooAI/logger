use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use chrono::{Datelike, Duration, Utc};
use parking_lot::Mutex;

#[derive(Clone, Debug)]
pub struct RotationOptions {
    pub path: PathBuf,
    pub filename_prefix: String,
    pub extension: String,
    pub size: Option<String>,
    pub interval: Option<String>,
    pub max_files: usize,
    pub max_total_size: Option<String>,
}

impl Default for RotationOptions {
    fn default() -> Self {
        Self {
            path: PathBuf::from(".smooai-logs"),
            filename_prefix: "output".into(),
            extension: "ansi".into(),
            size: Some("1M".into()),
            interval: Some("1d".into()),
            max_files: 30,
            max_total_size: Some("100M".into()),
        }
    }
}

#[derive(Debug)]
struct WriterState {
    file: File,
    bytes_written: u64,
    current_dir: PathBuf,
    current_path: PathBuf,
    index: u32,
    interval_anchor: chrono::DateTime<Utc>,
}

#[derive(Debug)]
pub struct RotatingFileWriter {
    options: RotationOptions,
    max_bytes: Option<u64>,
    max_total_bytes: Option<u64>,
    interval: Option<Duration>,
    state: Mutex<WriterState>,
}

impl RotatingFileWriter {
    pub fn new(options: RotationOptions) -> io::Result<Self> {
        let max_bytes = options.size.as_ref().and_then(|s| parse_size(s).ok());
        let max_total_bytes = options.max_total_size.as_ref().and_then(|s| parse_size(s).ok());
        let interval = options.interval.as_ref().and_then(|s| parse_interval(s).ok());

        let now = Utc::now();
        let (file, current_dir, current_path) = open_file(&options, &now, 0)?;
        let bytes_written = file.metadata().map(|m| m.len()).unwrap_or(0);

        Ok(Self {
            options,
            max_bytes,
            max_total_bytes,
            interval,
            state: Mutex::new(WriterState {
                file,
                bytes_written,
                current_dir,
                current_path,
                index: 0,
                interval_anchor: now,
            }),
        })
    }

    pub fn write(&self, payload: &str) -> io::Result<()> {
        let mut state = self.state.lock();
        let now = Utc::now();
        let payload_bytes = payload.as_bytes();
        if self.should_rotate(&state, &now, payload_bytes.len() as u64) {
            rotate(&self.options, &mut state, &now, self.max_total_bytes)?;
        }

        state.file.write_all(payload_bytes)?;
        state.bytes_written += payload_bytes.len() as u64;
        state.file.flush()
    }

    fn should_rotate(&self, state: &WriterState, now: &chrono::DateTime<Utc>, additional: u64) -> bool {
        if let Some(max_bytes) = self.max_bytes {
            if state.bytes_written + additional > max_bytes {
                return true;
            }
        }

        if let Some(interval) = self.interval {
            if *now - state.interval_anchor >= interval {
                return true;
            }
        }

        false
    }
}

fn rotate(options: &RotationOptions, state: &mut WriterState, now: &chrono::DateTime<Utc>, max_total_bytes: Option<u64>) -> io::Result<()> {
    let mut next_index = state.index + 1;
    let current_dir = log_directory(options, now);
    if current_dir != state.current_dir {
        next_index = 0;
    }

    let (file, dir, path) = open_file(options, now, next_index)?;

    state.file = file;
    state.bytes_written = 0;
    state.current_dir = dir.clone();
    state.current_path = path.clone();
    state.index = next_index;
    state.interval_anchor = *now;

    enforce_limits(options, &dir, max_total_bytes)
}

fn enforce_limits(options: &RotationOptions, directory: &Path, max_total_bytes: Option<u64>) -> io::Result<()> {
    if !directory.exists() {
        return Ok(());
    }

    let mut entries: Vec<_> = fs::read_dir(directory)?
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().map(|ft| ft.is_file()).unwrap_or(false))
        .filter(|entry| has_prefix(entry.file_name(), &options.filename_prefix, &options.extension))
        .collect();

    entries.sort_by(|a, b| {
        let a_time = a
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .unwrap_or_default();
        let b_time = b
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .unwrap_or_default();
        a_time.cmp(&b_time)
    });

    while entries.len() > options.max_files {
        if let Some(entry) = entries.first() {
            let _ = fs::remove_file(entry.path());
        }
        entries.remove(0);
    }

    if let Some(limit) = max_total_bytes {
        let mut total: u64 = entries.iter().filter_map(|entry| entry.metadata().ok().map(|m| m.len())).sum();
        while total > limit && !entries.is_empty() {
            if let Some(entry) = entries.first() {
                let path = entry.path();
                let size = entry.metadata().ok().map(|m| m.len()).unwrap_or(0);
                let _ = fs::remove_file(&path);
                total = total.saturating_sub(size);
            }
            entries.remove(0);
        }
    }

    Ok(())
}

fn has_prefix(name: std::ffi::OsString, prefix: &str, extension: &str) -> bool {
    let name = name.to_string_lossy();
    name.starts_with(prefix) && name.ends_with(extension)
}

fn open_file(options: &RotationOptions, now: &chrono::DateTime<Utc>, index: u32) -> io::Result<(File, PathBuf, PathBuf)> {
    let directory = log_directory(options, now);
    fs::create_dir_all(&directory)?;
    let filename = log_filename(options, now, index);
    let path = directory.join(filename);
    let file = OpenOptions::new().create(true).append(true).open(&path)?;
    Ok((file, directory, path))
}

fn log_directory(options: &RotationOptions, now: &chrono::DateTime<Utc>) -> PathBuf {
    let folder = format!("{:04}-{:02}", now.year(), now.month());
    options.path.join(folder)
}

fn log_filename(options: &RotationOptions, now: &chrono::DateTime<Utc>, index: u32) -> String {
    format!(
        "{}-{:04}-{:02}-{:02}-{:03}.{}",
        options.filename_prefix,
        now.year(),
        now.month(),
        now.day(),
        index,
        options.extension
    )
}

fn parse_size(size: &str) -> Result<u64, &'static str> {
    let upper = size.trim().to_uppercase();
    if let Some(stripped) = upper.strip_suffix('K') {
        return stripped.parse::<u64>().map(|n| n * 1024).map_err(|_| "invalid size");
    }
    if let Some(stripped) = upper.strip_suffix('M') {
        return stripped.parse::<u64>().map(|n| n * 1024 * 1024).map_err(|_| "invalid size");
    }
    if let Some(stripped) = upper.strip_suffix('G') {
        return stripped.parse::<u64>().map(|n| n * 1024 * 1024 * 1024).map_err(|_| "invalid size");
    }
    upper.parse::<u64>().map_err(|_| "invalid size")
}

fn parse_interval(interval: &str) -> Result<Duration, &'static str> {
    let lower = interval.trim().to_lowercase();
    if let Some(stripped) = lower.strip_suffix('s') {
        return stripped.parse::<i64>().map(Duration::seconds).map_err(|_| "invalid interval");
    }
    if let Some(stripped) = lower.strip_suffix('m') {
        return stripped.parse::<i64>().map(Duration::minutes).map_err(|_| "invalid interval");
    }
    if let Some(stripped) = lower.strip_suffix('h') {
        return stripped.parse::<i64>().map(Duration::hours).map_err(|_| "invalid interval");
    }
    if let Some(stripped) = lower.strip_suffix('d') {
        return stripped.parse::<i64>().map(Duration::days).map_err(|_| "invalid interval");
    }
    if let Some(stripped) = lower.strip_suffix('w') {
        return stripped.parse::<i64>().map(|weeks| Duration::days(7 * weeks)).map_err(|_| "invalid interval");
    }
    Err("invalid interval")
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn rotation_options_defaults() {
        let options = RotationOptions::default();
        assert_eq!(options.filename_prefix, "output");
    }

    #[test]
    fn rotating_writer_creates_file() {
        let dir = tempdir().unwrap();
        let options = RotationOptions {
            path: dir.path().into(),
            ..Default::default()
        };
        let writer = RotatingFileWriter::new(options).unwrap();
        writer.write("test line\n").unwrap();
    }
}
