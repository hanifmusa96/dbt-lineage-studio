# Lineage Studio

Explore your dbt project's data lineage locally, in a desktop app or a browser. Lineage Studio turns a dbt manifest into an interactive graph using [React Flow](https://reactflow.dev/) and [ELK](https://eclipse.dev/elk/), with a UI inspired by dbt-colibri.

## Features

- **Explore lineage:** Search and filter resources, focus a model, and expand or collapse its upstream and downstream dependencies.
- **Inspect resources:** View metadata and columns, or read a model's source code when you select a dbt project folder.
- **Navigate the graph:** Drag nodes, use the minimap, resize the details panel, and switch between light and dark themes.
- **Export:** Save the visible graph as SVG, JSON, or Mermaid.
- **Work locally:** Artifacts and source files are read on your device. The app does not persist them.

## Prerequisites

- Node.js **22.18 or newer** and npm.
- A dbt `manifest.json`. A `catalog.json` is optional and adds warehouse column metadata.
- For the desktop app, Rust and the [Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/).

Generate a manifest from your dbt project with `dbt compile`. To include a catalog, run `dbt docs generate` where supported by your dbt version. You can also use existing artifacts.

## Getting started

Clone this repository, open a terminal in its root directory, and install dependencies:

```sh
npm install
```

### Desktop

```sh
npm run tauri dev
```

In the import dialog, choose a dbt project folder or select `manifest.json` and optionally `catalog.json` separately. Project folders must contain `target/manifest.json`; `target/catalog.json` is loaded when present.

To build a desktop bundle for your current platform:

```sh
npm run tauri build
```

The command prints the bundle location. Signing and distribution may require additional platform-specific setup.

### Browser

```sh
npm run dev
```

Open the local URL printed by Vite. The development server attempts to load `target/manifest.json` and an optional `target/catalog.json` from this repository's working directory. You can also use **Import artifacts** to select a dbt project folder or individual files. Folder selection requires a browser that supports directory uploads.

```sh
npm run build
npm run preview
```

The preview server also supports local artifact auto-loading. Development and preview servers bind to localhost. A separately hosted static build can use the import dialog.

## Using the graph

1. Select a resource in the explorer to focus its lineage.
2. Use the **+ / −** controls on each node to expand or fold dependencies.
3. Click a node to open its details. Switch to **Raw code** for model source when a project folder is selected.
4. Choose an export format and select **Export** to save the currently expanded graph.

Drag the left edge of the details panel to resize it, or focus the edge and use the arrow keys. Exports include visible nodes outside the viewport but exclude folded branches. Graphs are limited to 100 nodes; focus another resource to explore further. Exports indicate when the graph is truncated.

## Notes and limitations

- Connections represent dbt **resource dependencies**, not verified column-level lineage. Tests are excluded from the graph.
- Source code requires selecting a project folder; importing artifacts individually or auto-loading them does not grant access to project files. Dependency models use the default `dbt_packages/<package>/` location; custom package installation paths are not supported.
- The desktop app restricts project reads to the selected folder, including resolved symlinks. In the browser, you may need to reselect a folder after files change.
- Project files and artifacts are not persisted by the app. The theme preference is saved in browser storage.

## Development

```sh
npm test             # Run tests
npm run typecheck    # Check TypeScript
npm run build        # Type-check and build the frontend
```

The app is organized by feature under [`src/features`](src/features), with shared components, styles, and types under `src/`. Tests are grouped by feature in [`src/testing`](src/testing). The Tauri desktop backend is in [`src-tauri`](src-tauri).
