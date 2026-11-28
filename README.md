# Lineage Studio

Explore your dbt project's data lineage locally, in a desktop app or a browser. Lineage Studio turns a dbt manifest into an interactive graph using [React Flow](https://reactflow.dev/) and [ELK](https://eclipse.dev/elk/), with a UI inspired by dbt-colibri.

## Features

- **Explore lineage:** Search and filter resources, focus a model, and expand or collapse its upstream and downstream dependencies.
- **Inspect resources:** View metadata and columns, or read a model's source code when you select a dbt project folder.
- **Navigate the graph:** Drag nodes, use the minimap, resize the details panel, and switch between light and dark themes.
- **Export:** Save the visible graph as SVG, JSON, or Mermaid.
- **Work locally:** Artifacts and source files are read on your device. The app does not persist them.

## Prerequisites

- Node.js **24 or newer** and npm. If you use nvm, run `nvm install` and `nvm use` in the project directory to use the version in `.nvmrc`.
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
npm run test:e2e     # Run browser smoke tests
npm run typecheck    # Check TypeScript
npm run build        # Type-check and build the frontend
```

The app is organized by feature under [`src/features`](src/features), with shared components, styles, and types under `src/`. Tests are grouped by feature in [`src/testing`](src/testing). The Tauri desktop backend is in [`src-tauri`](src-tauri).

For browser tests, install Chromium once with `npx playwright install chromium`.

## GitHub automation

CI runs the frontend tests and build, browser smoke tests, and desktop builds and Rust tests on macOS and Windows. Dependabot proposes weekly npm, Cargo, and GitHub Actions updates. CodeQL scans JavaScript and TypeScript; code scanning must be available and enabled for the repository. Enable Dependabot alerts and secret scanning in GitHub repository settings where available.

Dependabot's npm and GitHub Actions patch and minor updates targeting `main` are eligible for automatic approval and squash auto-merge; major updates and Cargo updates require manual review. Enable auto-merge, squash merging, and GitHub Actions pull request approvals in repository settings, and protect `main` with the required CI checks. Without required checks, eligible updates may merge before CI finishes. Existing pull requests must receive a new Dependabot event after the workflow is added.

Release Please uses conventional commit messages on `main` to maintain a release pull request. Use titles such as `fix: correct export`, `feat: add search`, or `feat!: change the API`; when squash merging, the squash commit must retain the conventional title. The release PR updates `CHANGELOG.md`, the application versions, and both lockfiles. Review and merge it when ready to release.

After the release PR is merged, Release Please creates a tag and a draft GitHub Release with generated notes. The desktop workflow builds macOS Apple Silicon and Intel DMGs and a Windows x64 NSIS installer and attaches them to the draft. Enable **Allow GitHub Actions to create and approve pull requests** in repository settings; workflows on the bot-created PR may require approval before required checks run. Review the draft and installer builds before publishing.

Pushing a matching version tag manually also builds installers and creates a draft release with GitHub-generated notes. The tag must match the versions in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`. macOS packages use ad-hoc signing and are **not notarized**; the Windows installer is unsigned. Public distribution requires platform signing and, for macOS, notarization credentials and additional setup.
