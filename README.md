# Lineage Studio

A local dbt lineage explorer inspired by dbt-colibri. It uses React Flow and ELK to display resource-level dependencies from `manifest.json`, optionally enriched with column metadata from `catalog.json`.

## Desktop app

Install [Tauri's desktop prerequisites](https://v2.tauri.app/start/prerequisites/), including Rust, and Node.js 22.18 or newer. Then:

1. Generate a manifest with `dbt compile`, or use an existing one. Optionally, run `dbt docs generate` to include a catalog.
2. Run `npm install` and `npm run tauri dev`.
3. Choose your dbt project folder in the import dialog, or select `manifest.json` and optionally `catalog.json` separately.

Run `npm run tauri build` to build a desktop bundle for the current platform. Platform-specific signing and distribution may require additional setup. Select a project or artifacts each time you launch the desktop app. Files are read locally and are not persisted by the app. Export opens a native save dialog.

## Browser development

With Node.js 22.18 or newer, run `npm install` and `npm run dev`, then open the local URL printed by Vite. The development and preview servers automatically load `target/manifest.json` and, if present, `target/catalog.json`; you can also select a project folder or separate files using **Import artifacts**. Folder selection requires a browser with directory upload support. The servers bind to localhost. `npm run build` builds the frontend; `npm run preview` serves it with the same local-artifact endpoints. A separately hosted static build can use the import dialog instead.

Choosing a project loads `target/manifest.json` and, if present, `target/catalog.json` from that folder. Without a catalog, lineage and manifest-defined column metadata remain available, but warehouse-derived column details are unavailable. Select a model in the graph and switch between **Details** and **Raw code** to read its source file. Source code is available only when a project folder has been selected; separately imported or automatically loaded artifacts do not grant access to project files. Dependency models are looked up under the default `dbt_packages/<package>/` directory; custom package installation paths are not supported. The desktop app restricts project reads to the selected folder, including resolved symlinks. In the browser, files are available from the selected folder upload and may need to be reselected after changes. Drag the left edge of the details panel to resize it, or focus the edge and use the left and right arrow keys.

Search for a resource, select it to focus its graph, and click a graph node for metadata. Use the **+ / −** buttons on the left and right of a node to expand or fold its upstream and downstream connections. Shared resources remain visible while connected through another expanded branch; reopening a branch restores its previous expansions. Graphs are limited to 100 nodes to keep large projects responsive; focus another resource to continue exploring.

Nodes show the resource name and its materialization when available. Hover over or focus a name to see it in full.

Use the minimap to pan or zoom around the graph; use the map button to show or hide it. The header theme button switches between light and dark mode and saves the choice in browser storage.

Use **Export** to download the current expanded graph as SVG, JSON, or Mermaid (`.mmd`). Exports include all displayed nodes, including those outside the current viewport, but exclude folded branches. JSON includes resource metadata and current positions. If the graph hits its 100-node limit, JSON, Mermaid, and SVG mark it as truncated. SVG uses the current theme and a simplified visual style; the full node name is available in its tooltip.

ELK positions the nodes; React Flow draws Bézier edges from shared incoming and outgoing attachment points. Dragging a node keeps its connections attached; expanding or folding a branch recalculates the layout. Curves may cross nodes or other edges in complex graphs.

Connections are dbt **resource dependencies**, not column-level lineage. The manifest and catalog alone do not provide verified column-to-column transformations. Tests are excluded from the graph.

## Development

The TypeScript code follows a feature-based structure: `src/features/` contains artifact import, lineage, and export, with feature-specific components, APIs, and utilities. `src/app/` composes the features; `src/components/`, `src/styles/`, and `src/types/` contain shared code. Tests are centralized under `src/testing/`, grouped by feature (unlike the Bulletproof React example, which uses that directory for shared test utilities and keeps feature tests near their code). Features depend on shared code rather than importing one another. Add shared folders only when they are needed.

Run `npm test` for the test suite or `npm run typecheck` to check types. `npm run build` also type-checks before building.
