# smooai-log-viewer

`smooai-log-viewer` is a desktop GUI application written in Rust. It loads structured log files from multiple services, normalizes them, and renders them in a responsive table using the `egui` immediate-mode UI toolkit. The following sections walk through the code layout and the main concepts a new Rust developer will encounter while exploring the project.

---

## 1. Project layout

```
log-viewer/
├── Cargo.toml          # Rust package manifest
├── src/
│   ├── main.rs         # Application entry point and UI logic
│   └── theme.rs        # Shared color palette + egui styling helpers
└── target/             # Build artifacts (generated)
```

The application is a single binary crate. When you run `cargo build --release`, Cargo compiles everything under `src/` into `target/release/smooai-log-viewer`.

---

## 2. Core dependencies

The `Cargo.toml` manifest declares the crate name, version, and dependencies:

```toml
[dependencies]
eframe = { version = "0.28", features = ["persistence"] }
egui    = "0.28"
egui_extras = "0.28"
anyhow  = "1"           # ergonomic error handling
rayon   = "1.10"        # parallel file parsing
memmap2 = "0.9"         # memory-map log files for fast scanning
serde / serde_json      # parse & manipulate JSON log entries
duckdb  = { version = "0.9.2", features = ["bundled"] }
rfd     = "0.15"        # native file chooser dialogs
```

Key crates (with docs):

- [`eframe`](https://docs.rs/eframe/latest/eframe/) – wraps `egui` and handles native window creation.
- [`egui`](https://docs.rs/egui/latest/egui/) / [`egui_extras`](https://docs.rs/egui_extras/latest/egui_extras/) – immediate-mode UI widgets and helpers like `TableBuilder`.
- [`anyhow`](https://docs.rs/anyhow/latest/anyhow/) – ergonomic error propagation.
- [`rayon`](https://docs.rs/rayon/latest/rayon/) – data-parallel iterators used when parsing many log files.
- [`memmap2`](https://docs.rs/memmap2/latest/memmap2/) – memory maps large log files so we can scan them without loading everything into RAM.
- [`serde`](https://docs.rs/serde/latest/serde/) / [`serde_json`](https://docs.rs/serde_json/latest/serde_json/) – parse JSON log payloads and flatten them into key/value maps.
- [`duckdb`](https://docs.rs/duckdb/latest/duckdb/) – embedded analytics database that stores the parsed rows for fast filtering.
- [`rfd`](https://docs.rs/rfd/latest/rfd/) – cross-platform native file/folder pickers.

---

## 3. Entry point (main.rs)

Rust executables start in `fn main()`. In `src/main.rs` the `main` function configures the `eframe::NativeOptions`, loads the application icon, and calls `eframe::run_native` with `App::default()`:

```rust
fn main() -> Result<()> {
    let native_options = eframe::NativeOptions { /* ... */ };
    eframe::run_native(
        "Smoo AI Log Viewer",
        native_options,
        Box::new(|_cc| Ok(Box::new(App::default()))),
    )?
```

`App` implements the `eframe::App` trait, so the `update` method is called every frame to draw the UI and process events.

### Struct `App`

`App` stores all runtime state: parsed catalog, filters, pagination, watcher thread handles, etc. New Rustaceans will notice that the struct mixes owned data (`Vec<Row>`, `HashMap`, etc.) with `Option<Receiver<_>>` channels. Rust’s ownership rules enforce that we move data into the background threads and only mutate the UI state on the main thread.

Key fields:

- `catalog: Catalog` – parsed logs + deduplicated column metadata.
- `filtered: Vec<usize>` – row indices after applying search filters.
- `index_rx: Option<mpsc::Receiver<IndexEvent>>` – channel for background indexing progress.
- `watch_handle`, `watch_stop` – thread handles / flags for filesystem watching.
- `visible_columns`, `column_widths` – dynamic column selection and sizing.
- `index_progress: Option<(usize, usize)>` – progress bar state.

### UI frame (`update`)

The `update` method orchestrates everything each frame:

1. Apply light/dark themes (`theme::apply_visuals`).
2. Drain any file watcher notifications and schedule reindexing if necessary.
3. Consume background indexing events; render a progress bar while indexing and merge the new catalog when finished.
4. Draw the top toolbar, left filter panel, and central table using `egui` widgets.
5. Draw the status bar with a “Live/Indexing” indicator and the latest status message.

Understanding borrowing rules is essential here: the code clones rows out of the catalog before rendering to avoid holding long-lived borrows while drawing each cell.

---

## 4. Parsing logs (Catalog + background indexer)

`Catalog` aggregates:

```rust
struct Catalog {
    files: Vec<FileEntry>,   // paths + sanitized lines
    rows:  Vec<Row>,         // flattened log entries across all files
    columns: Vec<String>,    // unique keys discovered in JSON payloads
    duckdb_path: Option<PathBuf>,
}
```

The function `index_monorepo(root: &Path, progress_tx: Option<Sender<IndexEvent>>)` does the heavy work. It:

1. Walks the filesystem rooting at `root`, gathering every `.smooai-logs` directory.
2. Uses `rayon::par_iter()` to memory-map each log file (`memmap2::Mmap`), split it into lines, and attempt to parse JSON blocks. Each block is flattened into key/value pairs (stored in `Row::flat`), and common columns (`time`, `level`, `msg`, `error`, etc.) are extracted into typed fields.
3. Sorts rows by timestamp, writes them into an embedded DuckDB table, and returns the finished `Catalog`.

An indexing thread sends `IndexEvent::Progress` updates over an `mpsc::Sender`, which the UI consumes to update the progress bar while the background job runs.

---

## 5. Rendering the log table

The table lives in `render_log_table`. Important ideas for Rust newcomers:

- `TableBuilder` from `egui_extras` builds a multi-column layout declaratively. Column widths are stored in a `HashMap<String, f32>` so a user’s adjustments persist through reindexes.
- `indices: Vec<usize>` clones the filtered row indices so we can iterate without holding a borrow into `self.filtered` while mutably updating the UI.
- Each cell is an `egui::Label`. For error fields we tint the text red (`theme::smoo::RED`), and we truncate long values but preserve tooltips via `response.on_hover_text(value.clone())`.
- Selecting a row stores its index in `self.selected` and drives the context view below the table.

Managing ownership and borrowing is the central lesson: clone the `Row` before rendering so you can move values into closures without fighting the borrow checker.

---

## 6. Context view & actions

Below the table, `render_context_panel` shows the source file, surrounding lines, and JSON view for the selected row. Buttons let you navigate to previous/next matches. Copying JSON uses `ui.output_mut(|o| o.copied_text = ...)`. The context menu on each cell (`response.context_menu`) provides “Open file” and “Open with…” actions; on macOS the latter runs `open -t` to launch the default text editor.

---

## 7. File watching & live mode

`watch_root` spawns a thread that scans `.smooai-logs` directories, tracking file modification times and sizes. When it detects a change it sends a `WatchEvent::FileChanged(path)` or `WatchEvent::FileRemoved(path)` over `watch_rx`. In **live mode** (the default) the main thread collects these events and `process_live_events` incrementally re-parses only the changed files—avoiding a full reindex. When live mode is disabled, changes are noted in the status bar but not applied until the user clicks **Reindex**. A full reindex can still be triggered manually at any time.

---

## 8. Theming (`theme.rs`)

`theme.rs` collects color constants and utility functions. New Rust devs will notice heavy use of `const fn` and `match` to map log levels to colors. `apply_visuals` modifies the global `egui::Context` styling: background colors, widget rounding, spacing, etc., keeping the UI consistent between light/dark modes.

---

## 9. Building & running locally

1. Install Rust + Cargo (`rustup` recommended).
2. `cd log-viewer`
3. `cargo run --release`

Because the project pulls in C dependencies (DuckDB bundles LLVM bits), the first build can take several minutes, but subsequent `cargo run` invocations are fast thanks to incremental compilation.

---

## 10. Next steps for newcomers

- Read through `render_log_table` with `rust-analyzer` (VS Code/VSCodium) to see how borrow checking is resolved. Hovering a symbol shows lifetime information and types.
- Experiment with adding a new filter field: update `Filters`, wire it into `apply_filters`, and add a `TextEdit` in the sidebar.
- Try enabling the `simd-json` feature (`cargo run --release --features simd`) to learn how feature flags change dependencies.
- Investigate `index_monorepo` to practice parallel iterators and error handling with `anyhow::Result`.

The codebase purposefully keeps most logic in two files so beginners can follow the flow without bouncing between many modules. As you get comfortable with ownership, channels, and `egui`, you can start breaking out pieces (e.g., parsing, DuckDB integration, UI widgets) into dedicated modules for long-term maintainability.
