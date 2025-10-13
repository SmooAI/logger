mod theme;

use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::fs::File;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{mpsc, Arc};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use anyhow::{anyhow, Context, Result};
use chrono::{DateTime, Utc};
use duckdb::{params, Connection};
use eframe::egui::{
    self, Color32, ColorImage, IconData, Image, Key, RichText, Sense, TextEdit, TextWrapMode,
    TextureHandle, TextureOptions, Vec2,
};
use egui_extras::{Column, TableBuilder};
use memmap2::Mmap;
use rayon::prelude::*;
use regex::Regex;
use rfd::FileDialog;
use serde_json::{json, Value};
use walkdir::WalkDir;

#[allow(dead_code)]
mod keys {
    pub const LEVEL: &str = "level";
    pub const LOG_LEVEL: &str = "LogLevel";
    pub const TIME: &str = "time";
    pub const MESSAGE: &str = "msg";

    pub const CORRELATION_ID: &str = "correlationId";
    pub const REQUEST_ID: &str = "requestId";
    pub const TRACE_ID: &str = "traceId";
    pub const NAME: &str = "name";
    pub const NAMESPACE: &str = "namespace";
    pub const SERVICE: &str = "service";
}

const APP_ICON_BYTES: &[u8] = include_bytes!("../assets/app-icon.png");
const LOGO_BYTES: &[u8] = include_bytes!("../assets/smoo-logo.png");

const BASE_COLUMNS: [(&str, &str); 9] = [
    ("time", "Timestamp"),
    ("level", "Level"),
    ("name", "Name"),
    ("namespace", "Namespace"),
    ("msg", "Message"),
    ("error", "Error"),
    ("errorDetails", "Error Details"),
    ("correlationId", "Correlation ID"),
    ("service", "Service"),
];

const BASE_COLUMN_DEFAULT_WIDTHS: &[(&str, f32)] = &[
    ("time", 200.0),
    ("level", 90.0),
    ("correlationId", 190.0),
    ("name", 200.0),
    ("namespace", 210.0),
    ("service", 170.0),
    ("msg", 320.0),
    ("error", 220.0),
    ("errorDetails", 240.0),
];

fn is_base_column(name: &str) -> bool {
    BASE_COLUMNS
        .iter()
        .any(|(key, _)| key.eq_ignore_ascii_case(name))
}

fn default_column_widths() -> HashMap<String, f32> {
    let mut map = HashMap::new();
    for (key, width) in BASE_COLUMN_DEFAULT_WIDTHS {
        map.insert((*key).to_string(), *width);
    }
    map
}

fn default_width_for_column(key: &str) -> f32 {
    BASE_COLUMN_DEFAULT_WIDTHS
        .iter()
        .find(|(name, _)| name.eq_ignore_ascii_case(key))
        .map(|(_, width)| *width)
        .unwrap_or(180.0)
}

fn header_label_for(key: &str) -> String {
    BASE_COLUMNS
        .iter()
        .find(|(name, _)| name.eq_ignore_ascii_case(key))
        .map(|(_, label)| (*label).to_string())
        .unwrap_or_else(|| key.to_string())
}

type ParsedFile = (PathBuf, Vec<String>, Vec<Row>, BTreeSet<String>);

enum IndexEvent {
    Progress { processed: usize, total: usize },
    Finished(Result<Catalog>),
}

enum WatchEvent {
    FileChanged(PathBuf),
    FileRemoved(PathBuf),
}

#[derive(Debug, Clone)]
struct FileEntry {
    path: PathBuf,
    sanitized_lines: Vec<String>,
}

#[derive(Debug, Clone)]
struct Row {
    file_id: usize,
    line_start: usize,
    line_end: usize,
    ts: Option<DateTime<Utc>>,
    level: Option<String>,
    corr: Option<String>,
    name: Option<String>,
    msg: Option<String>,
    service: Option<String>,
    namespace: Option<String>,
    trace_id: Option<String>,
    request_id: Option<String>,
    flat: BTreeMap<String, String>,
    raw_json: String,
}

#[derive(Default, Clone)]
struct Catalog {
    files: Vec<FileEntry>,
    rows: Vec<Row>,
    columns: Vec<String>,
    duckdb_path: Option<PathBuf>,
}

#[derive(Clone)]
struct Extractor;

impl Extractor {
    fn new() -> Self {
        Self
    }

    #[cfg(feature = "simd")]
    fn parse_json(&self, slice: &str) -> Option<Value> {
        simd_json::serde::from_str(slice).ok()
    }

    #[cfg(not(feature = "simd"))]
    fn parse_json(&self, slice: &str) -> Option<Value> {
        serde_json::from_str(slice).ok()
    }

    fn pick_str<'a>(&self, obj: &'a Value, key: &str) -> Option<&'a str> {
        obj.get(key).and_then(|value| value.as_str())
    }

    fn pick_level<'a>(&self, obj: &'a Value) -> Option<&'a str> {
        self.pick_str(obj, keys::LEVEL)
            .or_else(|| self.pick_str(obj, keys::LOG_LEVEL))
    }

    fn pick_ts(&self, obj: &Value) -> Option<DateTime<Utc>> {
        let raw = self.pick_str(obj, keys::TIME)?;
        if let Ok(dt) = raw.parse::<DateTime<Utc>>() {
            return Some(dt);
        }
        if !raw.ends_with('Z') {
            if let Ok(dt) = format!("{raw}Z").parse::<DateTime<Utc>>() {
                return Some(dt);
            }
        }
        if let Ok(numeric) = raw.parse::<i64>() {
            if numeric > 10_000_000_000 {
                let secs = numeric / 1_000;
                let ns = (numeric % 1_000) * 1_000_000;
                return DateTime::<Utc>::from_timestamp(secs, ns as u32);
            }
            return DateTime::<Utc>::from_timestamp(numeric, 0);
        }
        None
    }

    #[allow(clippy::type_complexity)]
    fn extract(
        &self,
        obj: &Value,
    ) -> (
        Option<DateTime<Utc>>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
    ) {
        let ts = self.pick_ts(obj);
        let level = self.pick_level(obj).map(|s| s.to_string());
        let corr = self
            .pick_str(obj, keys::CORRELATION_ID)
            .map(|s| s.to_string());
        let name = self.pick_str(obj, keys::NAME).map(|s| s.to_string());
        let msg = self.pick_str(obj, keys::MESSAGE).map(|s| s.to_string());
        let service = self.pick_str(obj, keys::SERVICE).map(|s| s.to_string());
        let namespace = self.pick_str(obj, keys::NAMESPACE).map(|s| s.to_string());
        let trace_id = self.pick_str(obj, keys::TRACE_ID).map(|s| s.to_string());
        let request_id = self.pick_str(obj, keys::REQUEST_ID).map(|s| s.to_string());
        (
            ts, level, corr, name, msg, service, namespace, trace_id, request_id,
        )
    }
}

#[derive(Default, Clone)]
struct Filters {
    text: String,
    level: String,
    corr: String,
    service: String,
    namespace: String,
    trace: String,
    request: String,
    regex_mode: bool,
}

enum ColumnAddResult {
    Added(String),
    AlreadyVisible(String),
    BaseColumn(String),
    NotFound(String),
    Empty,
}

struct App {
    root: PathBuf,
    pending_root: PathBuf,
    catalog: Catalog,
    filtered: Vec<usize>,
    selected: Option<usize>,
    page: usize,
    page_size: usize,
    ctx_before: usize,
    ctx_after: usize,
    status: String,
    sort_desc: bool,
    filters: Filters,
    re_cache: HashMap<String, Regex>,
    dark_mode: bool,
    logo_image: Option<ColorImage>,
    logo_texture: Option<TextureHandle>,
    logo_size: Vec2,
    index_rx: Option<mpsc::Receiver<IndexEvent>>,
    indexing: bool,
    show_startup_modal: bool,
    watch_rx: Option<mpsc::Receiver<WatchEvent>>,
    watch_handle: Option<thread::JoinHandle<()>>,
    watch_stop: Option<Arc<AtomicBool>>,
    pending_reindex: bool,
    live_mode: bool,
    pending_watch_events: Vec<WatchEvent>,
    visible_columns: Vec<String>,
    column_search: String,
    expanded_rows: HashSet<usize>,
    column_widths: HashMap<String, f32>,
    index_progress: Option<(usize, usize)>,
}

impl Default for App {
    fn default() -> Self {
        let root = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        let (logo_image, logo_size) = match load_logo_image() {
            Some((image, size)) => (Some(image), size),
            None => (None, Vec2::splat(64.0)),
        };
        Self {
            root: root.clone(),
            pending_root: root,
            catalog: Catalog::default(),
            filtered: Vec::new(),
            selected: None,
            page: 0,
            page_size: 200,
            ctx_before: 2,
            ctx_after: 2,
            status: "Choose a directory to index".into(),
            sort_desc: true,
            filters: Filters::default(),
            re_cache: HashMap::new(),
            dark_mode: true,
            logo_image,
            logo_texture: None,
            logo_size,
            index_rx: None,
            indexing: false,
            show_startup_modal: true,
            watch_rx: None,
            watch_handle: None,
            watch_stop: None,
            pending_reindex: false,
            live_mode: true,
            pending_watch_events: Vec::new(),
            visible_columns: vec!["traceId".into(), "requestId".into()],
            column_search: String::new(),
            expanded_rows: HashSet::new(),
            column_widths: default_column_widths(),
            index_progress: None,
        }
    }
}

impl App {
    fn start_index(&mut self, path: PathBuf, ctx: &egui::Context) {
        self.status = format!("Indexing {}…", path.display());
        self.index_progress = None;
        self.pending_watch_events.clear();
        let (tx, rx) = mpsc::channel();
        self.index_rx = Some(rx);
        self.indexing = true;
        let ctx_clone = ctx.clone();
        let progress_sender = tx.clone();
        thread::spawn(move || {
            let result = index_monorepo(&path, Some(progress_sender));
            let _ = tx.send(IndexEvent::Finished(result));
            ctx_clone.request_repaint();
        });
    }

    fn apply_filters(&mut self) {
        let filters = self.filters.clone();

        let re_text = if filters.regex_mode {
            self.compile(&filters.text)
        } else {
            None
        };
        let re_level = if filters.regex_mode {
            self.compile(&filters.level)
        } else {
            None
        };
        let re_corr = if filters.regex_mode {
            self.compile(&filters.corr)
        } else {
            None
        };
        let re_service = if filters.regex_mode {
            self.compile(&filters.service)
        } else {
            None
        };
        let re_namespace = if filters.regex_mode {
            self.compile(&filters.namespace)
        } else {
            None
        };
        let re_trace = if filters.regex_mode {
            self.compile(&filters.trace)
        } else {
            None
        };
        let re_request = if filters.regex_mode {
            self.compile(&filters.request)
        } else {
            None
        };

        let lowercase = |input: &str| input.to_ascii_lowercase();
        let text = lowercase(&filters.text);
        let level = lowercase(&filters.level);
        let corr = lowercase(&filters.corr);
        let service = lowercase(&filters.service);
        let namespace = lowercase(&filters.namespace);
        let trace = lowercase(&filters.trace);
        let request = lowercase(&filters.request);

        self.filtered.clear();

        for (idx, row) in self.catalog.rows.iter().enumerate() {
            if !filters.level.is_empty() {
                let matches = row.level.as_ref().is_some_and(|value| {
                    if let Some(re) = &re_level {
                        re.is_match(value)
                    } else {
                        value.to_ascii_lowercase().contains(&level)
                    }
                });
                if !matches {
                    continue;
                }
            }

            if !filters.corr.is_empty() {
                let matches = row.corr.as_ref().is_some_and(|value| {
                    if let Some(re) = &re_corr {
                        re.is_match(value)
                    } else {
                        value.to_ascii_lowercase().contains(&corr)
                    }
                });
                if !matches {
                    continue;
                }
            }

            if !filters.service.is_empty() {
                let matches = row.service.as_ref().is_some_and(|value| {
                    if let Some(re) = &re_service {
                        re.is_match(value)
                    } else {
                        value.to_ascii_lowercase().contains(&service)
                    }
                });
                if !matches {
                    continue;
                }
            }

            if !filters.namespace.is_empty() {
                let matches = row.namespace.as_ref().is_some_and(|value| {
                    if let Some(re) = &re_namespace {
                        re.is_match(value)
                    } else {
                        value.to_ascii_lowercase().contains(&namespace)
                    }
                });
                if !matches {
                    continue;
                }
            }

            if !filters.trace.is_empty() {
                let matches = row.trace_id.as_ref().is_some_and(|value| {
                    if let Some(re) = &re_trace {
                        re.is_match(value)
                    } else {
                        value.to_ascii_lowercase().contains(&trace)
                    }
                });
                if !matches {
                    continue;
                }
            }

            if !filters.request.is_empty() {
                let matches = row.request_id.as_ref().is_some_and(|value| {
                    if let Some(re) = &re_request {
                        re.is_match(value)
                    } else {
                        value.to_ascii_lowercase().contains(&request)
                    }
                });
                if !matches {
                    continue;
                }
            }

            if !filters.text.is_empty() {
                let mut haystack = String::new();
                if let Some(value) = row.msg.as_ref() {
                    haystack.push_str(value);
                    haystack.push(' ');
                }
                if let Some(value) = row.corr.as_ref() {
                    haystack.push_str(value);
                    haystack.push(' ');
                }
                if let Some(value) = row.level.as_ref() {
                    haystack.push_str(value);
                    haystack.push(' ');
                }
                if let Some(value) = row.service.as_ref() {
                    haystack.push_str(value);
                    haystack.push(' ');
                }
                if let Some(value) = row.namespace.as_ref() {
                    haystack.push_str(value);
                    haystack.push(' ');
                }
                if let Some(value) = row.trace_id.as_ref() {
                    haystack.push_str(value);
                    haystack.push(' ');
                }
                if let Some(value) = row.request_id.as_ref() {
                    haystack.push_str(value);
                    haystack.push(' ');
                }
                for value in row.flat.values() {
                    haystack.push_str(value);
                    haystack.push(' ');
                }
                let matches = if let Some(re) = &re_text {
                    re.is_match(&haystack)
                } else {
                    haystack.to_ascii_lowercase().contains(&text)
                };
                if !matches {
                    continue;
                }
            }

            self.filtered.push(idx);
        }

        self.page = 0;
        self.selected = None;
        self.status = format!("{} matches", self.filtered.len());
    }

    fn compile(&mut self, source: &str) -> Option<Regex> {
        if source.is_empty() {
            return None;
        }
        if let Some(cached) = self.re_cache.get(source) {
            return Some(cached.clone());
        }
        Regex::new(source)
            .inspect(|regex| {
                self.re_cache.insert(source.to_string(), regex.clone());
            })
            .ok()
    }

    fn has_rows(&self) -> bool {
        !self.filtered.is_empty()
    }

    fn dynamic_columns(&self) -> Vec<String> {
        if self.catalog.columns.is_empty() {
            return Vec::new();
        }
        let available: HashSet<&str> = self.catalog.columns.iter().map(|c| c.as_str()).collect();
        let mut seen = HashSet::new();
        self.visible_columns
            .iter()
            .filter_map(|column| {
                if is_base_column(column) {
                    return None;
                }
                if !available.contains(column.as_str()) {
                    return None;
                }
                let lower = column.to_ascii_lowercase();
                if !seen.insert(lower) {
                    return None;
                }
                Some(column.clone())
            })
            .collect()
    }

    fn prune_visible_columns(&mut self) {
        if self.catalog.columns.is_empty() {
            self.visible_columns.clear();
            return;
        }
        let mut normalized = Vec::new();
        let mut seen = HashSet::new();
        for column in &self.visible_columns {
            if is_base_column(column) {
                continue;
            }
            if let Some(canonical) = self
                .catalog
                .columns
                .iter()
                .find(|candidate| candidate.eq_ignore_ascii_case(column))
                .cloned()
            {
                let lower = canonical.to_ascii_lowercase();
                if seen.insert(lower) {
                    normalized.push(canonical);
                }
            }
        }
        self.visible_columns = normalized;
    }

    fn add_visible_column(&mut self, column: &str) -> bool {
        if is_base_column(column) {
            return false;
        }
        if self
            .visible_columns
            .iter()
            .any(|existing| existing.eq_ignore_ascii_case(column))
        {
            return false;
        }
        self.visible_columns.push(column.to_string());
        true
    }

    fn remove_visible_column(&mut self, column: &str) {
        self.visible_columns
            .retain(|existing| !existing.eq_ignore_ascii_case(column));
    }

    fn process_live_events(&mut self, ctx: &egui::Context) {
        if !self.live_mode || self.indexing || self.pending_watch_events.is_empty() {
            return;
        }

        let mut changed = BTreeSet::new();
        let mut removed = BTreeSet::new();

        for event in self.pending_watch_events.drain(..) {
            match event {
                WatchEvent::FileChanged(path) => {
                    if !removed.contains(&path) {
                        changed.insert(path);
                    }
                }
                WatchEvent::FileRemoved(path) => {
                    changed.remove(&path);
                    removed.insert(path);
                }
            }
        }

        if changed.is_empty() && removed.is_empty() {
            return;
        }

        let extractor = Extractor::new();
        let mut updated_files = 0usize;
        let mut removed_files = 0usize;
        let mut errors = Vec::new();

        for path in removed {
            if self.remove_file_by_path(&path) {
                removed_files += 1;
            }
        }

        for path in changed {
            match self.refresh_file_from_disk(&path, &extractor) {
                Ok(true) => {
                    updated_files += 1;
                }
                Ok(false) => {}
                Err(error) => {
                    errors.push((path, error));
                }
            }
        }

        if updated_files > 0 || removed_files > 0 {
            self.sync_after_catalog_changes();
            let mut parts = Vec::new();
            if updated_files > 0 {
                parts.push(format!(
                    "updated {} file{}",
                    updated_files,
                    if updated_files == 1 { "" } else { "s" }
                ));
            }
            if removed_files > 0 {
                parts.push(format!(
                    "removed {} file{}",
                    removed_files,
                    if removed_files == 1 { "" } else { "s" }
                ));
            }
            self.status = format!("Live update: {}", parts.join(", "));
            ctx.request_repaint();
        }

        if let Some((path, error)) = errors.first() {
            self.status = format!("Live update error for {}: {:#}", path.display(), error);
        }
    }

    fn refresh_file_from_disk(&mut self, path: &Path, extractor: &Extractor) -> Result<bool> {
        let existing_index = self
            .catalog
            .files
            .iter()
            .position(|file| file.path == *path);
        let file_id = existing_index.unwrap_or(self.catalog.files.len());

        let (sanitized_lines, mut rows) = index_single_file(file_id, path, extractor)?;
        for row in &mut rows {
            row.file_id = file_id;
        }

        if let Some(idx) = existing_index {
            if self.catalog.files[idx].sanitized_lines == sanitized_lines {
                return Ok(false);
            }
        }

        self.catalog.rows.retain(|row| row.file_id != file_id);

        if let Some(idx) = existing_index {
            self.catalog.files[idx].sanitized_lines = sanitized_lines;
        } else {
            self.catalog.files.push(FileEntry {
                path: path.to_path_buf(),
                sanitized_lines,
            });
        }

        self.catalog.rows.extend(rows);
        Ok(true)
    }

    fn remove_file_by_path(&mut self, path: &Path) -> bool {
        if let Some(index) = self
            .catalog
            .files
            .iter()
            .position(|file| file.path == *path)
        {
            self.catalog.files.remove(index);
            self.catalog.rows.retain(|row| row.file_id != index);
            for row in &mut self.catalog.rows {
                if row.file_id > index {
                    row.file_id -= 1;
                }
            }
            true
        } else {
            false
        }
    }

    fn sync_after_catalog_changes(&mut self) {
        self.catalog.rows.sort_by(|left, right| {
            left.ts
                .cmp(&right.ts)
                .then_with(|| left.file_id.cmp(&right.file_id))
                .then_with(|| left.line_start.cmp(&right.line_start))
        });
        if self.sort_desc {
            self.catalog.rows.reverse();
        }

        let mut column_set = BTreeSet::new();
        for row in &self.catalog.rows {
            for key in row.flat.keys() {
                column_set.insert(key.clone());
            }
        }
        self.catalog.columns = column_set.into_iter().collect();
        self.prune_visible_columns();
        self.filtered.clear();
        self.apply_filters();
        self.selected = None;
        self.page = 0;
        if let Some(old_db) = self.catalog.duckdb_path.take() {
            let _ = std::fs::remove_file(old_db);
        }
    }

    fn open_file_with_dialog(&mut self, row: &Row) {
        let file = &self.catalog.files[row.file_id];
        if let Some(app_path) = FileDialog::new()
            .set_title("Choose application")
            .pick_file()
        {
            match open_file_with_app(&file.path, &app_path) {
                Ok(_) => {
                    self.status =
                        format!("Opened {} with {}", file.path.display(), app_path.display());
                }
                Err(error) => {
                    self.status = format!("Failed to open with app: {error}");
                }
            }
        }
    }

    fn column_width_for(&mut self, key: &str) -> f32 {
        let default = default_width_for_column(key);
        *self.column_widths.entry(key.to_string()).or_insert(default)
    }

    fn update_column_width_entry(&mut self, key: &str, width: f32) {
        let entry = self.column_widths.entry(key.to_string()).or_insert(width);
        if (width - *entry).abs() > 0.5 {
            *entry = width;
        }
    }

    fn handle_header_response(
        &mut self,
        ctx: &egui::Context,
        key: &str,
        response: &egui::Response,
    ) {
        let width = response.rect.width().max(60.0);
        self.update_column_width_entry(key, width);
        if response.double_clicked() {
            let target = self.auto_column_width(ctx, key);
            self.column_widths.insert(key.to_string(), target);
            ctx.request_repaint();
        }
    }

    fn auto_column_width(&self, ctx: &egui::Context, key: &str) -> f32 {
        let mut max_width = 0.0;
        let header_text = header_label_for(key);
        let rows = &self.catalog.rows;
        let sample = rows.len().min(1500);
        ctx.fonts(|fonts| {
            let font_id = ctx.style().text_styles[&egui::TextStyle::Body].clone();
            max_width = fonts
                .layout_no_wrap(header_text.clone(), font_id.clone(), Color32::WHITE)
                .rect
                .width();

            for row in rows.iter().take(sample) {
                let value = resolve_row_value(row, key);
                if value.is_empty() {
                    continue;
                }
                let width = fonts
                    .layout_no_wrap(value, font_id.clone(), Color32::WHITE)
                    .rect
                    .width();
                if width > max_width {
                    max_width = width;
                }
            }
        });

        (max_width + 32.0).clamp(80.0, 1024.0)
    }

    fn render_log_table(&mut self, ui: &mut egui::Ui, ctx: &egui::Context) {
        let extra_columns = self.dynamic_columns();

        egui::ScrollArea::both()
            .auto_shrink([false, false])
            .show(ui, |ui| {
                ui.set_width(ui.available_width());
                let available = ui.available_height();

                let mut table = TableBuilder::new(ui)
                    .striped(true)
                    .min_scrolled_height(available.max(200.0));
                table = table.column(Column::initial(28.0).resizable(false).clip(true));
                table = table.sense(egui::Sense::click());

                for (key, _) in BASE_COLUMNS.iter() {
                    let width = self.column_width_for(key);
                    let min_width = match *key {
                        "msg" => 220.0,
                        "name" => 160.0,
                        _ => 110.0,
                    };
                    table = table.column(
                        Column::initial(width)
                            .resizable(true)
                            .clip(true)
                            .at_least(min_width),
                    );
                }

                for column in &extra_columns {
                    let width = self.column_width_for(column.as_str());
                    table = table.column(
                        Column::initial(width)
                            .resizable(true)
                            .clip(true)
                            .at_least(140.0),
                    );
                }

                let header_bg = theme::header_background(self.dark_mode);
                let grid_stroke = theme::grid_stroke(self.dark_mode);

                table
                    .header(28.0, |mut header| {
                        header.col(|ui| {
                            let response = ui.label(RichText::new(" ").background_color(header_bg));
                            ui.painter().rect_stroke(response.rect, 0.0, grid_stroke);
                        });

                        for (key, label) in BASE_COLUMNS.iter() {
                            header.col(|ui| {
                                let response = ui.add(
                                    egui::Label::new(
                                        RichText::new(*label).strong().background_color(header_bg),
                                    )
                                    .sense(Sense::click()),
                                );
                                ui.painter().rect_stroke(response.rect, 0.0, grid_stroke);
                                self.handle_header_response(ctx, key, &response);
                            });
                        }

                        for column in &extra_columns {
                            header.col(|ui| {
                                let response = ui.add(
                                    egui::Label::new(
                                        RichText::new(column).strong().background_color(header_bg),
                                    )
                                    .sense(Sense::click()),
                                );
                                ui.painter().rect_stroke(response.rect, 0.0, grid_stroke);
                                self.handle_header_response(ctx, column.as_str(), &response);
                            });
                        }
                    })
                    .body(|mut body| {
                        let start = self.page * self.page_size;
                        let end = (start + self.page_size).min(self.filtered.len());
                        let indices: Vec<usize> = self.filtered[start..end].to_vec();

                        for (row_offset, row_idx) in indices.into_iter().enumerate() {
                            let filtered_idx = start + row_offset;
                            let _is_selected = self.selected == Some(filtered_idx);
                            let row = self.catalog.rows[row_idx].clone();

                            let ts_value = resolve_row_value(&row, "time");
                            let level_value = resolve_row_value(&row, "level");
                            let corr_value = resolve_row_value(&row, "correlationId");
                            let name_value = resolve_row_value(&row, "name");
                            let namespace_value = resolve_row_value(&row, "namespace");
                            let service_value = resolve_row_value(&row, "service");
                            let msg_value = resolve_row_value(&row, "msg");
                            let msg_display = shorten_for_display(&msg_value, 180);
                            let error_value = resolve_row_value(&row, "error");
                            let error_display = shorten_for_display(&error_value, 160);
                            let error_details_value = resolve_row_value(&row, "errorDetails");
                            let error_details_display =
                                shorten_for_display(&error_details_value, 160);

                            let is_expanded = self.expanded_rows.contains(&row_idx);
                            let (pretty_json, json_lines) = if is_expanded {
                                let (formatted, lines) = format_json_for_display(&row.raw_json);
                                (Some(formatted), lines)
                            } else {
                                (None, 0)
                            };
                            let extra_height = if is_expanded {
                                ((json_lines as f32) * 18.0 + 12.0).clamp(54.0, 360.0)
                            } else {
                                0.0
                            };
                            let row_height = 22.0 + extra_height;

                            let mut open_file_request = false;
                            let mut open_with_request = false;

                            body.row(row_height, |mut row_ui| {
                                let mut row_clicked = false;

                                row_ui.col(|ui| {
                                    let symbol = if is_expanded { "⌄" } else { "›" };
                                    let response = ui.add(
                                        egui::Label::new(
                                            RichText::new(symbol).color(Color32::from_gray(180)),
                                        )
                                        .sense(Sense::click()),
                                    );
                                    if response.clicked() {
                                        if is_expanded {
                                            self.expanded_rows.remove(&row_idx);
                                        } else {
                                            self.expanded_rows.insert(row_idx);
                                        }
                                    }
                                });

                                let mut process_response =
                                    |response: egui::Response, row_clicked: &mut bool| {
                                        if response.clicked() {
                                            *row_clicked = true;
                                        }
                                        if response.secondary_clicked() {
                                            open_file_request = true;
                                        }
                                        let _ = response.context_menu(|ui| {
                                            if ui.button("Open file").clicked() {
                                                open_file_request = true;
                                                ui.close_menu();
                                            }
                                            if ui.button("Open with…").clicked() {
                                                open_with_request = true;
                                                ui.close_menu();
                                            }
                                        });
                                    };

                                for (key, _) in BASE_COLUMNS.iter() {
                                    let raw_value = match *key {
                                        "time" => ts_value.clone(),
                                        "level" => level_value.clone(),
                                        "correlationId" => corr_value.clone(),
                                        "name" => name_value.clone(),
                                        "namespace" => namespace_value.clone(),
                                        "service" => service_value.clone(),
                                        "msg" => msg_value.clone(),
                                        "error" => error_value.clone(),
                                        "errorDetails" => error_details_value.clone(),
                                        _ => resolve_row_value(&row, key),
                                    };

                                    let display_value = match *key {
                                        "msg" => msg_display.clone(),
                                        "error" => error_display.clone(),
                                        "errorDetails" => error_details_display.clone(),
                                        _ => raw_value.clone(),
                                    };

                                    let mut rich = RichText::new(display_value.clone());
                                    if matches!(*key, "error" | "errorDetails")
                                        && !raw_value.trim().is_empty()
                                    {
                                        rich = rich.color(theme::smoo::RED);
                                    }

                                    row_ui.col(|ui| {
                                        let response = ui.add(
                                            egui::Label::new(rich.clone())
                                                .truncate()
                                                .sense(Sense::click()),
                                        );
                                        let response = response.on_hover_text(raw_value.clone());
                                        process_response(response, &mut row_clicked);

                                        if *key == "msg" && is_expanded {
                                            if let Some(json) = pretty_json.as_ref() {
                                                ui.add_space(6.0);
                                                let max_height = ((json_lines as f32) * 18.0
                                                    + 12.0)
                                                    .clamp(54.0, 360.0);
                                                egui::ScrollArea::vertical()
                                                    .max_height(max_height)
                                                    .show(ui, |ui| {
                                                        ui.scope(|ui| {
                                                            ui.style_mut().wrap_mode =
                                                                Some(TextWrapMode::Extend);
                                                            ui.monospace(json);
                                                        });
                                                    });
                                            }
                                        }
                                    });
                                }

                                for column in &extra_columns {
                                    let full_value = resolve_row_value(&row, column);
                                    let value = shorten_for_display(&full_value, 160);

                                    row_ui.col(|ui| {
                                        let response = ui.add(
                                            egui::Label::new(RichText::new(value.clone()))
                                                .truncate()
                                                .sense(Sense::click()),
                                        );
                                        let response = response.on_hover_text(full_value.clone());
                                        process_response(response, &mut row_clicked);
                                    });
                                }

                                if row_clicked {
                                    self.selected = Some(filtered_idx);
                                }
                            });

                            if open_file_request {
                                let file = &self.catalog.files[row.file_id];
                                match open_file_with_default(&file.path) {
                                    Ok(_) => {
                                        self.status = format!("Opened {}", file.path.display());
                                    }
                                    Err(error) => {
                                        self.status = format!("Failed to open file: {error}");
                                    }
                                }
                            }

                            if open_with_request {
                                self.open_file_with_dialog(&row);
                            }
                        }
                    });
            });
    }

    fn render_context_panel(&mut self, ui: &mut egui::Ui) {
        ui.heading("Context (within the same file)");

        if let Some(selected_idx) = self.selected {
            let row_idx = self.filtered[selected_idx];
            let row = &self.catalog.rows[row_idx];
            let (start, end) = self.context_range(row);
            let file = &self.catalog.files[row.file_id];
            let highlight = if self.dark_mode {
                theme::dark_theme().ring
            } else {
                theme::light_theme().ring
            };

            egui::ScrollArea::vertical().show(ui, |ui| {
                ui.monospace(format!("File: {}", file.path.display()));
                for idx in start..end {
                    let line = file
                        .sanitized_lines
                        .get(idx)
                        .map(|s| s.as_str())
                        .unwrap_or("<binary>");
                    if idx >= row.line_start && idx <= row.line_end {
                        ui.colored_label(highlight, line);
                    } else {
                        ui.colored_label(theme::smoo::GRAY_400, line);
                    }
                }
            });

            if let Ok(json_value) = serde_json::from_str::<Value>(&row.raw_json) {
                ui.separator();
                ui.heading("JSON");
                render_json_root(ui, &json_value);
            }

            ui.horizontal(|ui| {
                if ui.button("⟸ Prev match").clicked() && selected_idx > 0 {
                    self.selected = Some(selected_idx - 1);
                }
                if ui.button("Next match ⟹").clicked() && selected_idx + 1 < self.filtered.len() {
                    self.selected = Some(selected_idx + 1);
                }
                if ui.button("Copy selected JSON").clicked() {
                    ui.output_mut(|output| output.copied_text = row.raw_json.clone());
                    self.status = "Copied".into();
                }
            });
        } else {
            ui.label("Select a row to view context.");
        }
    }

    fn resolve_column_name(&self, input: &str) -> Option<String> {
        let query = input.trim();
        if query.is_empty() {
            return None;
        }
        if self.catalog.columns.is_empty() {
            return None;
        }

        if let Some(exact) = self.catalog.columns.iter().find(|column| column == &query) {
            return Some(exact.clone());
        }

        if let Some(case_insensitive) = self
            .catalog
            .columns
            .iter()
            .find(|column| column.eq_ignore_ascii_case(query))
        {
            return Some(case_insensitive.clone());
        }

        let lowered_query = query.to_ascii_lowercase();
        let mut prefix_match: Option<String> = None;
        let mut substring_match: Option<String> = None;
        let mut best_distance: Option<(String, usize)> = None;

        for column in &self.catalog.columns {
            let lowered = column.to_ascii_lowercase();
            if prefix_match.is_none() && lowered.starts_with(&lowered_query) {
                prefix_match = Some(column.clone());
            }
            if substring_match.is_none() && lowered.contains(&lowered_query) {
                substring_match = Some(column.clone());
            }
            let distance = levenshtein(&lowered, &lowered_query);
            if distance <= 3 {
                match &best_distance {
                    Some((_, best)) if distance >= *best => {}
                    _ => best_distance = Some((column.clone(), distance)),
                }
            }
        }

        prefix_match
            .or(substring_match)
            .or(best_distance.map(|(column, _)| column))
    }

    fn column_suggestions(&self) -> Vec<String> {
        if self.catalog.columns.is_empty() {
            return Vec::new();
        }
        let query = self.column_search.trim().to_ascii_lowercase();
        let mut suggestions = Vec::new();

        for column in &self.catalog.columns {
            if is_base_column(column) {
                continue;
            }
            if self
                .visible_columns
                .iter()
                .any(|visible| visible.eq_ignore_ascii_case(column))
            {
                continue;
            }
            let lowered = column.to_ascii_lowercase();
            if query.is_empty() || lowered.starts_with(&query) || lowered.contains(&query) {
                suggestions.push(column.clone());
            }
        }

        if suggestions.is_empty() && !query.is_empty() {
            if let Some(resolved) = self.resolve_column_name(&self.column_search) {
                if !is_base_column(&resolved)
                    && !self
                        .visible_columns
                        .iter()
                        .any(|visible| visible.eq_ignore_ascii_case(&resolved))
                {
                    suggestions.push(resolved);
                }
            }
        }

        suggestions.truncate(5);
        suggestions
    }

    fn try_add_column_from_search(&mut self) -> ColumnAddResult {
        let query = self.column_search.trim().to_string();
        if query.is_empty() {
            return ColumnAddResult::Empty;
        }
        if let Some(resolved) = self.resolve_column_name(&query) {
            if is_base_column(&resolved) {
                return ColumnAddResult::BaseColumn(resolved);
            }
            if self
                .visible_columns
                .iter()
                .any(|visible| visible.eq_ignore_ascii_case(&resolved))
            {
                self.column_search.clear();
                return ColumnAddResult::AlreadyVisible(resolved);
            }
            self.visible_columns.push(resolved.clone());
            self.column_search.clear();
            ColumnAddResult::Added(resolved)
        } else {
            ColumnAddResult::NotFound(query)
        }
    }

    fn context_range(&self, row: &Row) -> (usize, usize) {
        let file = &self.catalog.files[row.file_id];
        let total = file.sanitized_lines.len();
        let start = row.line_start.saturating_sub(self.ctx_before);
        let mut end = row.line_end + 1 + self.ctx_after;
        if end > total {
            end = total;
        }
        (start, end)
    }

    fn ensure_logo_texture(&mut self, ctx: &egui::Context) {
        if self.logo_texture.is_some() {
            return;
        }
        if let Some(image) = self.logo_image.clone() {
            let texture = ctx.load_texture("smoo-logo", image, TextureOptions::LINEAR);
            self.logo_texture = Some(texture);
            self.logo_image = None;
        }
    }

    fn watch_root(&mut self, path: PathBuf) {
        if let Some(stop) = self.watch_stop.take() {
            stop.store(false, Ordering::SeqCst);
        }
        if let Some(handle) = self.watch_handle.take() {
            let _ = handle.join();
        }

        let (tx, rx) = mpsc::channel();
        self.watch_rx = Some(rx);

        let stop_flag = Arc::new(AtomicBool::new(true));
        let thread_flag = stop_flag.clone();

        let handle = thread::spawn(move || {
            let mut known: HashMap<PathBuf, (SystemTime, u64)> = HashMap::new();
            for dir in find_smooai_log_dirs(&path) {
                for file in list_log_files(&dir) {
                    if let Ok(metadata) = std::fs::metadata(&file) {
                        if let Ok(modified) = metadata.modified() {
                            known.insert(file.clone(), (modified, metadata.len()));
                        }
                    }
                }
            }

            while thread_flag.load(Ordering::SeqCst) {
                let mut seen = HashSet::new();
                for dir in find_smooai_log_dirs(&path) {
                    for file in list_log_files(&dir) {
                        seen.insert(file.clone());
                        if let Ok(metadata) = std::fs::metadata(&file) {
                            if let Ok(modified) = metadata.modified() {
                                let len = metadata.len();
                                match known.get(&file) {
                                    Some((prev_mod, prev_len))
                                        if *prev_mod >= modified && *prev_len == len => {}
                                    _ => {
                                        known.insert(file.clone(), (modified, len));
                                        let _ = tx.send(WatchEvent::FileChanged(file.clone()));
                                    }
                                }
                            }
                        }
                    }
                }
                let removed: Vec<PathBuf> = known
                    .keys()
                    .filter(|path| !seen.contains(*path))
                    .cloned()
                    .collect();
                for path in removed {
                    known.remove(&path);
                    let _ = tx.send(WatchEvent::FileRemoved(path));
                }
                thread::sleep(Duration::from_secs(2));
            }
        });

        self.watch_stop = Some(stop_flag);
        self.watch_handle = Some(handle);
    }

    fn stop_watch(&mut self) {
        if let Some(stop) = self.watch_stop.take() {
            stop.store(false, Ordering::SeqCst);
        }
        if let Some(handle) = self.watch_handle.take() {
            let _ = handle.join();
        }
        self.watch_rx = None;
        self.pending_watch_events.clear();
    }
}

impl Drop for App {
    fn drop(&mut self) {
        self.stop_watch();
        if let Some(path) = self.catalog.duckdb_path.take() {
            let _ = std::fs::remove_file(path);
        }
    }
}

impl eframe::App for App {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        theme::apply_visuals(ctx, self.dark_mode);
        self.ensure_logo_texture(ctx);

        if let Some(rx) = &self.watch_rx {
            while let Ok(event) = rx.try_recv() {
                if self.live_mode {
                    self.pending_watch_events.push(event);
                } else {
                    self.status =
                        "Log changes detected while live mode is off. Reindex to refresh.".into();
                }
            }
        }

        let mut finished_event: Option<Result<Catalog>> = None;
        if let Some(receiver) = self.index_rx.as_ref() {
            while let Ok(event) = receiver.try_recv() {
                match event {
                    IndexEvent::Progress { processed, total } => {
                        let capped_total = total.max(1);
                        let capped_processed = processed.min(capped_total);
                        self.index_progress = Some((capped_processed, total));
                        self.status = format!("Indexing {}/{} files", capped_processed, total);
                        ctx.request_repaint();
                    }
                    IndexEvent::Finished(result) => {
                        finished_event = Some(result);
                        break;
                    }
                }
            }
        }

        if let Some(result) = finished_event {
            self.indexing = false;
            self.index_rx = None;
            self.index_progress = None;
            match result {
                Ok(mut catalog) => {
                    if self.sort_desc {
                        catalog.rows.reverse();
                    }
                    if let Some(old) = self.catalog.duckdb_path.take() {
                        let _ = std::fs::remove_file(old);
                    }
                    self.catalog = catalog;
                    self.prune_visible_columns();
                    self.expanded_rows.clear();
                    self.filtered = (0..self.catalog.rows.len()).collect();
                    self.selected = None;
                    self.page = 0;
                    self.apply_filters();
                    self.status = format!(
                        "Indexed {} files, {} rows",
                        self.catalog.files.len(),
                        self.catalog.rows.len()
                    );
                }
                Err(error) => {
                    self.status = format!("Index error: {error:#}");
                }
            }
        }

        if self.pending_reindex && !self.indexing {
            self.pending_reindex = false;
            let root = self.root.clone();
            self.start_index(root, ctx);
        }

        if !self.indexing {
            self.process_live_events(ctx);
        }

        if self.show_startup_modal {
            egui::Window::new("Choose log directory")
                .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
                .collapsible(false)
                .resizable(false)
                .show(ctx, |ui| {
                    ui.label("Select the root folder containing `.smooai-logs/`.");
                    let mut path_string = self.pending_root.display().to_string();
                    ui.add_enabled(false, TextEdit::singleline(&mut path_string));
                    if ui.button("Browse…").clicked() {
                        if let Some(dir) = FileDialog::new()
                            .set_directory(&self.pending_root)
                            .pick_folder()
                        {
                            self.pending_root = dir;
                        }
                    }
                    if ui.button("Start watching").clicked() {
                        self.root = self.pending_root.clone();
                        self.show_startup_modal = false;
                        if self.live_mode {
                            self.watch_root(self.root.clone());
                        } else {
                            self.stop_watch();
                        }
                        self.start_index(self.root.clone(), ctx);
                    }
                });
        }

        egui::TopBottomPanel::top("top").show(ctx, |ui| {
            ui.horizontal_wrapped(|ui| {
                if let Some(texture) = &self.logo_texture {
                    let target = 36.0_f32;
                    let scale = target / self.logo_size.x.max(1.0);
                    let display_size = self.logo_size * scale;
                    let response = ui
                        .add(Image::new(texture).fit_to_exact_size(display_size))
                        .on_hover_text("Smoo AI");
                    if response.clicked() {
                        open_url("https://smoo.ai");
                    }
                    ui.separator();
                }
                if ui.button("Change Root…").clicked() {
                    if let Some(dir) = FileDialog::new().set_directory(&self.root).pick_folder() {
                        self.pending_root = dir.clone();
                        self.root = dir.clone();
                        if self.live_mode {
                            self.watch_root(dir.clone());
                        } else {
                            self.stop_watch();
                        }
                        self.start_index(dir, ctx);
                    }
                }
                if ui.button("Reindex").clicked() {
                    self.start_index(self.root.clone(), ctx);
                }
                let was_live_mode = self.live_mode;
                if ui.checkbox(&mut self.live_mode, "Live mode").changed() {
                    if self.live_mode {
                        self.watch_root(self.root.clone());
                        self.status = "Live mode enabled. Watching for log deltas.".into();
                    } else {
                        self.stop_watch();
                        self.status = "Live mode disabled.".into();
                    }
                }
                if was_live_mode != self.live_mode {
                    ui.ctx().request_repaint();
                }
                ui.separator();
                ui.label(
                    RichText::new(self.root.display().to_string()).color(Color32::from_gray(170)),
                );
                ui.separator();
                ui.checkbox(&mut self.sort_desc, "Newest first");
                if ui.button("Apply sort").clicked() {
                    if self.sort_desc {
                        self.catalog.rows.reverse();
                    } else {
                        self.catalog.rows.sort_by(|a, b| {
                            a.ts.cmp(&b.ts)
                                .then_with(|| a.file_id.cmp(&b.file_id))
                                .then_with(|| a.line_start.cmp(&b.line_start))
                        });
                    }
                    self.apply_filters();
                }
                ui.separator();
                ui.toggle_value(&mut self.dark_mode, "🌙 Dark");
                ui.separator();
            });
        });

        egui::SidePanel::left("filters")
            .resizable(true)
            .default_width(330.0)
            .show(ctx, |ui| {
                ui.heading("Filters");
                ui.add(
                    TextEdit::singleline(&mut self.filters.text).hint_text("search across fields"),
                );
                ui.add(TextEdit::singleline(&mut self.filters.level).hint_text("level / LogLevel"));
                ui.add(TextEdit::singleline(&mut self.filters.corr).hint_text("correlationId"));
                ui.add(TextEdit::singleline(&mut self.filters.service).hint_text("service"));
                ui.add(TextEdit::singleline(&mut self.filters.namespace).hint_text("namespace"));
                ui.add(TextEdit::singleline(&mut self.filters.trace).hint_text("traceId"));
                ui.add(TextEdit::singleline(&mut self.filters.request).hint_text("requestId"));
                ui.checkbox(&mut self.filters.regex_mode, "Regex mode");
                if ui.button("Apply filters").clicked() {
                    self.apply_filters();
                }

                ui.separator();
                ui.heading("Pagination");
                ui.add(egui::Slider::new(&mut self.page_size, 50..=3000).text("rows/page"));
                ui.horizontal(|ui| {
                    if ui.button("Prev").clicked() && self.page > 0 {
                        self.page -= 1;
                    }
                    let total_pages =
                        ((self.filtered.len() + self.page_size - 1) / self.page_size.max(1)).max(1);
                    ui.label(format!("Page {} / {}", self.page + 1, total_pages));
                    if ui.button("Next").clicked() && self.page + 1 < total_pages {
                        self.page += 1;
                    }
                });

                ui.separator();
                ui.heading("Context");
                ui.add(egui::Slider::new(&mut self.ctx_before, 0..=50).text("lines before"));
                ui.add(egui::Slider::new(&mut self.ctx_after, 0..=50).text("lines after"));

                ui.separator();
                ui.heading("Columns");
                ui.label("Select extra fields to render on demand.");

                let mut request_add = false;
                ui.horizontal(|ui| {
                    let response = ui.add(
                        TextEdit::singleline(&mut self.column_search).hint_text("add column…"),
                    );
                    if response.lost_focus() && ui.input(|i| i.key_pressed(Key::Enter)) {
                        request_add = true;
                    }
                    if ui.button("Add").clicked() {
                        request_add = true;
                    }
                });

                let add_feedback = if request_add {
                    Some(self.try_add_column_from_search())
                } else {
                    None
                };

                if let Some(result) = add_feedback {
                    match result {
                        ColumnAddResult::Added(name) => {
                            ui.colored_label(
                                Color32::from_rgb(120, 200, 120),
                                format!("Added column '{name}'."),
                            );
                        }
                        ColumnAddResult::AlreadyVisible(name) => {
                            ui.colored_label(
                                Color32::from_rgb(200, 180, 30),
                                format!("Column '{name}' is already visible."),
                            );
                        }
                        ColumnAddResult::BaseColumn(name) => {
                            ui.colored_label(
                                Color32::from_rgb(200, 100, 60),
                                format!("'{name}' is part of the default view."),
                            );
                        }
                        ColumnAddResult::NotFound(name) => {
                            ui.colored_label(
                                Color32::from_rgb(200, 100, 60),
                                format!("No column matched '{name}'."),
                            );
                        }
                        ColumnAddResult::Empty => {}
                    }
                }

                let suggestions = self.column_suggestions();
                if !suggestions.is_empty() {
                    ui.label("Suggestions:");
                    ui.horizontal_wrapped(|ui| {
                        for suggestion in suggestions {
                            if ui.button(format!("+ {suggestion}")).clicked()
                                && self.add_visible_column(&suggestion)
                            {
                                self.column_search.clear();
                            }
                        }
                    });
                }

                let extras = self.dynamic_columns();
                if extras.is_empty() {
                    ui.label("No additional columns selected.");
                } else {
                    ui.label("Visible extra columns:");
                    ui.horizontal_wrapped(|ui| {
                        for column in extras {
                            if ui.button(format!("{column} ✕")).clicked() {
                                self.remove_visible_column(&column);
                            }
                        }
                    });
                }
            });

        egui::CentralPanel::default().show(ctx, |ui| {
            if self.indexing {
                ui.vertical_centered(|ui| {
                    ui.add_space(200.0);
                    if let Some((processed, total)) = self.index_progress {
                        let total = total.max(1);
                        let processed = processed.min(total);
                        let fraction = (processed as f32 / total as f32).clamp(0.0, 1.0);
                        let text = format!("Indexing {processed}/{total} files");
                        ui.add(
                            egui::ProgressBar::new(fraction)
                                .show_percentage()
                                .text(text),
                        );
                    } else {
                        ui.spinner();
                    }
                    ui.add_space(12.0);
                    ui.label(&self.status);
                });
                return;
            }

            if !self.has_rows() {
                ui.label("Index your monorepo (finds all `.smooai-logs/`) to begin.");
                return;
            }

            // Split the central area into resizable top (table) and bottom (context) sections
            egui::TopBottomPanel::bottom("context_panel")
                .resizable(true)
                .default_height(300.0)
                .min_height(150.0)
                .show_inside(ui, |ui| {
                    self.render_context_panel(ui);
                });

            egui::CentralPanel::default().show_inside(ui, |ui| {
                self.render_log_table(ui, ctx);
            });
        });
    }
}

fn flatten_json_map(value: &Value) -> BTreeMap<String, String> {
    let mut map = BTreeMap::new();
    if let Value::Object(obj) = value {
        for (key, val) in obj {
            flatten_value(val, key, &mut map);
        }
    }
    map
}

fn flatten_value(value: &Value, prefix: &str, out: &mut BTreeMap<String, String>) {
    match value {
        Value::Object(obj) => {
            for (key, val) in obj {
                let new_prefix = if prefix.is_empty() {
                    key.to_string()
                } else {
                    format!("{prefix}.{key}")
                };
                flatten_value(val, &new_prefix, out);
            }
        }
        Value::Array(arr) => {
            for (idx, val) in arr.iter().enumerate() {
                let new_prefix = if prefix.is_empty() {
                    format!("[{idx}]")
                } else {
                    format!("{prefix}[{idx}]")
                };
                flatten_value(val, &new_prefix, out);
            }
        }
        _ => {
            if !prefix.is_empty() {
                out.insert(prefix.to_string(), value_to_string(value));
            }
        }
    }
}

fn value_to_string(value: &Value) -> String {
    match value {
        Value::Null => "null".to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.to_string(),
        Value::String(s) => s.clone(),
        Value::Array(_) | Value::Object(_) => serde_json::to_string(value).unwrap_or_default(),
    }
}

fn resolve_row_value(row: &Row, key: &str) -> String {
    match key {
        "time" => row.ts.map(|t| t.to_rfc3339()).unwrap_or_default(),
        "level" => row.level.clone().unwrap_or_default(),
        "msg" => row.msg.clone().unwrap_or_default(),
        "correlationId" => row.corr.clone().unwrap_or_default(),
        "name" => row.name.clone().unwrap_or_default(),
        "service" => row.service.clone().unwrap_or_default(),
        "namespace" => row.namespace.clone().unwrap_or_default(),
        "traceId" => row.trace_id.clone().unwrap_or_default(),
        "requestId" => row.request_id.clone().unwrap_or_default(),
        "error" | "errorDetails" => row
            .flat
            .get(key)
            .cloned()
            .or_else(|| row.flat.get(&format!("@{key}")).cloned())
            .unwrap_or_default(),
        _ => row.flat.get(key).cloned().unwrap_or_default(),
    }
}

fn format_json_for_display(raw: &str) -> (String, usize) {
    if let Ok(value) = serde_json::from_str::<Value>(raw) {
        if let Ok(pretty) = serde_json::to_string_pretty(&value) {
            let lines = pretty.lines().count().max(1);
            return (pretty, lines);
        }
    }
    let fallback = raw.to_string();
    let lines = fallback.lines().count().max(1);
    (fallback, lines)
}

#[cfg(target_os = "macos")]
fn open_file_with_default(path: &Path) -> Result<()> {
    Command::new("open")
        .args(["-t", path.to_string_lossy().as_ref()])
        .status()
        .with_context(|| format!("open {path:?}"))?
        .success()
        .then_some(())
        .ok_or_else(|| anyhow!("open command failed"))
}

#[cfg(target_os = "macos")]
fn open_file_with_app(path: &Path, app: &Path) -> Result<()> {
    Command::new("open")
        .arg("-a")
        .arg(app)
        .arg(path)
        .status()
        .with_context(|| format!("open {path:?} with {app:?}"))?
        .success()
        .then_some(())
        .ok_or_else(|| anyhow!("open command failed"))
}

#[cfg(target_os = "linux")]
fn open_file_with_default(path: &Path) -> Result<()> {
    Command::new("xdg-open")
        .arg(path)
        .status()
        .with_context(|| format!("open {path:?}"))?
        .success()
        .then_some(())
        .ok_or_else(|| anyhow!("xdg-open command failed"))
}

#[cfg(target_os = "linux")]
fn open_file_with_app(path: &Path, app: &Path) -> Result<()> {
    Command::new(app)
        .arg(path)
        .status()
        .with_context(|| format!("launch {app:?} {path:?}"))?
        .success()
        .then_some(())
        .ok_or_else(|| anyhow!("application command failed"))
}

#[cfg(target_os = "windows")]
fn open_file_with_default(path: &Path) -> Result<()> {
    Command::new("cmd")
        .args(["/C", "start", "", path.to_string_lossy().as_ref()])
        .status()
        .with_context(|| format!("open {path:?}"))?
        .success()
        .then_some(())
        .ok_or_else(|| anyhow!("start command failed"))
}

#[cfg(target_os = "windows")]
fn open_file_with_app(path: &Path, app: &Path) -> Result<()> {
    Command::new(app)
        .arg(path)
        .status()
        .with_context(|| format!("launch {app:?} {path:?}"))?
        .success()
        .then_some(())
        .ok_or_else(|| anyhow!("application command failed"))
}

#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn open_file_with_default(_path: &Path) -> Result<()> {
    Err(anyhow!("opening files is not supported on this platform"))
}

#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn open_file_with_app(_path: &Path, _app: &Path) -> Result<()> {
    Err(anyhow!(
        "opening files with specific app is not supported on this platform"
    ))
}

fn index_single_file(
    file_id: usize,
    path: &Path,
    extractor: &Extractor,
) -> Result<(Vec<String>, Vec<Row>)> {
    let mmap = mmap_file(path)?;
    let lines = scan_lines(&mmap);
    let sanitized_lines = sanitize_lines(&mmap, &lines);
    let (rows, _columns) = parse_rows(file_id, path, &lines, &sanitized_lines, extractor);
    Ok((sanitized_lines, rows))
}

fn index_monorepo(root: &Path, progress_tx: Option<mpsc::Sender<IndexEvent>>) -> Result<Catalog> {
    let log_dirs = find_smooai_log_dirs(root);
    let mut catalog = Catalog::default();

    if log_dirs.is_empty() {
        return Ok(catalog);
    }

    let files: Vec<PathBuf> = log_dirs
        .iter()
        .flat_map(|dir| list_log_files(dir))
        .collect();

    let total_files = files.len();
    if let Some(tx) = &progress_tx {
        let _ = tx.send(IndexEvent::Progress {
            processed: 0,
            total: total_files,
        });
    }

    let extractor = Extractor::new();

    let processed_files = AtomicUsize::new(0);
    let mut tmp_files: Vec<ParsedFile> = files
        .par_iter()
        .enumerate()
        .map(|(file_id, path)| {
            let mmap = mmap_file(path);
            if mmap.is_err() {
                return (path.clone(), Vec::new(), Vec::new(), BTreeSet::new());
            }
            let mmap = mmap.unwrap();
            let lines = scan_lines(&mmap);
            let sanitized_lines = sanitize_lines(&mmap, &lines);
            let (rows, columns) = parse_rows(file_id, path, &lines, &sanitized_lines, &extractor);
            if let Some(tx) = &progress_tx {
                let current = processed_files.fetch_add(1, Ordering::SeqCst) + 1;
                let _ = tx.send(IndexEvent::Progress {
                    processed: current.min(total_files),
                    total: total_files,
                });
            }
            (path.clone(), sanitized_lines, rows, columns)
        })
        .collect();

    tmp_files.sort_by(|a, b| a.0.cmp(&b.0));

    let mut column_set = BTreeSet::new();
    for (path, sanitized_lines, mut rows, cols) in tmp_files {
        column_set.extend(cols);
        catalog.files.push(FileEntry {
            path,
            sanitized_lines,
        });
        catalog.rows.append(&mut rows);
    }

    catalog.rows.sort_by(|left, right| {
        left.ts
            .cmp(&right.ts)
            .then_with(|| left.file_id.cmp(&right.file_id))
            .then_with(|| left.line_start.cmp(&right.line_start))
    });

    catalog.columns = column_set.into_iter().collect();

    let mut db_path = std::env::temp_dir();
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    db_path.push(format!("smooai-log-viewer-{unique}.duckdb"));

    let conn = Connection::open(&db_path).context("open duckdb database")?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS logs (
            row_id BIGINT PRIMARY KEY,
            file_id BIGINT,
            line_start BIGINT,
            line_end BIGINT,
            ts TIMESTAMP,
            ts_text TEXT,
            level TEXT,
            corr TEXT,
            name TEXT,
            msg TEXT,
            service TEXT,
            namespace TEXT,
            trace_id TEXT,
            request_id TEXT,
            raw_json TEXT,
            flat_json TEXT
        )",
        [],
    )?;

    for (row_id, row) in catalog.rows.iter().enumerate() {
        let ts_string = row.ts.map(|t| t.to_rfc3339());
        let flat_json = serde_json::to_string(&row.flat).unwrap_or_else(|_| "{}".into());
        conn.execute(
            "INSERT INTO logs (
                row_id, file_id, line_start, line_end, ts, ts_text, level, corr, name, msg,
                service, namespace, trace_id, request_id, raw_json, flat_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                row_id as i64,
                row.file_id as i64,
                row.line_start as i64,
                row.line_end as i64,
                ts_string.as_deref(),
                ts_string.as_deref(),
                row.level.as_deref(),
                row.corr.as_deref(),
                row.name.as_deref(),
                row.msg.as_deref(),
                row.service.as_deref(),
                row.namespace.as_deref(),
                row.trace_id.as_deref(),
                row.request_id.as_deref(),
                row.raw_json,
                flat_json,
            ],
        )?;
    }

    catalog.duckdb_path = Some(db_path);

    Ok(catalog)
}

fn parse_rows(
    file_id: usize,
    _path: &Path,
    lines: &[LineHeader],
    sanitized_lines: &[String],
    extractor: &Extractor,
) -> (Vec<Row>, BTreeSet<String>) {
    let mut rows = Vec::new();
    let mut columns = BTreeSet::new();
    let mut idx = 0;

    while idx < lines.len() {
        let sanitized_trim = sanitized_lines[idx].trim();
        if sanitized_trim.is_empty() || sanitized_trim.chars().all(|c| c == '-') {
            idx += 1;
            continue;
        }

        let mut block = String::new();
        let mut end_idx = idx;
        let mut parsed_value: Option<Value> = None;

        while end_idx < lines.len() {
            if !block.is_empty() {
                block.push('\n');
            }
            block.push_str(sanitized_lines[end_idx].as_str());
            let trimmed = block.trim();
            if trimmed.is_empty() {
                end_idx += 1;
                continue;
            }
            if let Some(value) = extractor.parse_json(trimmed) {
                parsed_value = Some(value);
                break;
            }
            end_idx += 1;
        }

        let (value, raw_text) = if let Some(value) = parsed_value {
            (value, block.trim().to_string())
        } else {
            let raw = block.trim().to_string();
            (json!({ "msg": raw.clone() }), raw)
        };

        let (ts, level, corr, name, msg, service, namespace, trace_id, request_id) =
            extractor.extract(&value);
        let flat = flatten_json_map(&value);
        for key in flat.keys() {
            columns.insert(key.clone());
        }

        rows.push(Row {
            file_id,
            line_start: idx,
            line_end: end_idx,
            ts,
            level,
            corr,
            name,
            msg,
            service,
            namespace,
            trace_id,
            request_id,
            flat,
            raw_json: raw_text.clone(),
        });

        idx = end_idx + 1;
    }

    (rows, columns)
}

fn shorten_for_display(input: &str, max: usize) -> String {
    if input.chars().count() <= max {
        return input.to_string();
    }
    let trimmed: String = input.chars().take(max).collect();
    format!("{}...", trimmed)
}

fn levenshtein(left: &str, right: &str) -> usize {
    if left == right {
        return 0;
    }
    if left.is_empty() {
        return right.len();
    }
    if right.is_empty() {
        return left.len();
    }

    let left_bytes = left.as_bytes();
    let right_bytes = right.as_bytes();

    let mut previous: Vec<usize> = (0..=right_bytes.len()).collect();
    let mut current = vec![0; right_bytes.len() + 1];

    for (i, &left_byte) in left_bytes.iter().enumerate() {
        current[0] = i + 1;
        for (j, &right_byte) in right_bytes.iter().enumerate() {
            let cost = if left_byte == right_byte { 0 } else { 1 };
            current[j + 1] = (current[j] + 1)
                .min(previous[j + 1] + 1)
                .min(previous[j] + cost);
        }
        previous.copy_from_slice(&current);
    }

    previous[right_bytes.len()]
}

fn strip_ansi_codes(input: &[u8]) -> Vec<u8> {
    let mut output = Vec::with_capacity(input.len());
    let mut i = 0;
    while i < input.len() {
        if input[i] == 0x1B {
            i += 1;
            if i < input.len() && (input[i] == b'[' || input[i] == b']') {
                i += 1;
                while i < input.len() && !(input[i] >= 0x40 && input[i] <= 0x7E) {
                    i += 1;
                }
                if i < input.len() {
                    i += 1;
                }
            }
        } else {
            output.push(input[i]);
            i += 1;
        }
    }
    output
}

fn sanitize_lines(mmap: &Mmap, headers: &[LineHeader]) -> Vec<String> {
    let bytes = &mmap[..];
    let mut lines = Vec::with_capacity(headers.len());
    for header in headers {
        let start = header.offset as usize;
        let end = start + header.len as usize;
        let slice = &bytes[start..end];
        let sanitized = strip_ansi_codes(slice);
        let mut text = String::from_utf8_lossy(&sanitized).to_string();
        if text.ends_with('\r') {
            text.pop();
        }
        lines.push(text);
    }
    lines
}

fn find_smooai_log_dirs(root: &Path) -> Vec<PathBuf> {
    WalkDir::new(root)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_dir() && entry.file_name() == ".smooai-logs")
        .map(|entry| entry.path().to_path_buf())
        .collect()
}

fn list_log_files(dir: &Path) -> Vec<PathBuf> {
    WalkDir::new(dir)
        .max_depth(1)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry.file_type().is_file()
                && entry
                    .path()
                    .extension()
                    .map(|ext| ext == "ansi" || ext == "log" || ext == "json" || ext == "jsonl")
                    .unwrap_or(false)
        })
        .map(|entry| entry.path().to_path_buf())
        .collect()
}

fn scan_lines(mmap: &Mmap) -> Vec<LineHeader> {
    let bytes = &mmap[..];
    let mut lines = Vec::with_capacity(1024);
    let mut start = 0usize;

    for (idx, byte) in bytes.iter().enumerate() {
        if *byte == b'\n' {
            if idx > start {
                lines.push(LineHeader {
                    offset: start as u64,
                    len: (idx - start) as u32,
                });
            }
            start = idx + 1;
        }
    }

    if start < bytes.len() {
        lines.push(LineHeader {
            offset: start as u64,
            len: (bytes.len() - start) as u32,
        });
    }

    lines
}

fn mmap_file(path: &Path) -> Result<Mmap> {
    let file = File::open(path).with_context(|| format!("open {path:?}"))?;
    unsafe { Mmap::map(&file).context("mmap") }
}

#[derive(Debug, Clone, Copy)]
struct LineHeader {
    offset: u64,
    len: u32,
}

fn render_json_root(ui: &mut egui::Ui, value: &Value) {
    match value {
        Value::Object(map) => {
            for (key, val) in map {
                render_json_node(ui, key.to_string(), val);
            }
        }
        Value::Array(items) => {
            for (idx, val) in items.iter().enumerate() {
                render_json_node(ui, format!("[{idx}]"), val);
            }
        }
        _ => {
            ui.label(value_to_string(value));
        }
    }
}

fn render_json_node(ui: &mut egui::Ui, label: String, value: &Value) {
    match value {
        Value::Object(map) => {
            egui::CollapsingHeader::new(label)
                .default_open(false)
                .show(ui, |ui| {
                    for (key, val) in map {
                        render_json_node(ui, key.to_string(), val);
                    }
                });
        }
        Value::Array(items) => {
            egui::CollapsingHeader::new(label)
                .default_open(false)
                .show(ui, |ui| {
                    for (idx, val) in items.iter().enumerate() {
                        render_json_node(ui, format!("[{idx}]"), val);
                    }
                });
        }
        _ => {
            ui.label(format!("{label}: {}", value_to_string(value)));
        }
    }
}

fn open_url(url: &str) {
    #[cfg(target_os = "macos")]
    let mut command = Command::new("open");
    #[cfg(target_os = "linux")]
    let mut command = Command::new("xdg-open");
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut c = Command::new("rundll32");
        c.arg("url.dll,FileProtocolHandler");
        c
    };

    #[cfg(not(target_os = "windows"))]
    command.arg(url);
    #[cfg(target_os = "windows")]
    command.arg(url);

    let _ = command.spawn();
}

fn load_logo_image() -> Option<(ColorImage, Vec2)> {
    let image = image::load_from_memory(LOGO_BYTES).ok()?.into_rgba8();
    let (width, height) = image.dimensions();
    let size = Vec2::new(width as f32, height as f32);
    Some((
        ColorImage::from_rgba_unmultiplied([width as usize, height as usize], &image),
        size,
    ))
}

fn load_app_icon() -> Option<IconData> {
    let image = image::load_from_memory(APP_ICON_BYTES).ok()?.into_rgba8();
    let (width, height) = image.dimensions();
    Some(IconData {
        rgba: image.into_raw(),
        width,
        height,
    })
}

fn main() -> Result<()> {
    let mut viewport = egui::ViewportBuilder::default().with_inner_size([1380.0, 900.0]);
    if let Some(icon) = load_app_icon() {
        viewport = viewport.with_icon(icon);
    }
    let native_options = eframe::NativeOptions {
        viewport,
        ..Default::default()
    };
    eframe::run_native(
        "Smoo AI Log Viewer",
        native_options,
        Box::new(|_cc| Ok(Box::new(App::default()))),
    )
    .map_err(|err| anyhow!(err.to_string()))?;
    Ok(())
}
