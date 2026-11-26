# Lineage Studio

A local dbt lineage explorer inspired by dbt-colibri. It uses React Flow and ELK to display resource-level dependencies from `manifest.json`, enriched with column metadata from `catalog.json`.

## Desktop app

Install [Tauri's desktop prerequisites](https://v2.tauri.app/start/prerequisites/), including Rust, and Node.js. Then:

1. Generate dbt artifacts with `dbt compile` and `dbt docs generate`, or use existing artifacts.
2. Run `npm install` and `npm run tauri dev`.
3. Select `manifest.json` and `catalog.json` in the import dialog.

Run `npm run tauri build` to build a desktop bundle for the current platform. Platform-specific signing and distribution may require additional setup. The desktop app does not automatically load a project directory: select both files each time you launch it. Artifacts are read locally and are not persisted by the app. Export opens a native save dialog.

## Browser development

Run `npm install` and `npm run dev`, then open the local URL printed by Vite. The development and preview servers automatically load `target/manifest.json` and `target/catalog.json`; you can also select files using **Import artifacts**. They bind to localhost. `npm run build` builds the frontend; `npm run preview` serves it with the same local-artifact endpoints. A separately hosted static build can use the import dialog instead.

Search for a resource, select it to focus its graph, and click a graph node for metadata. Use the **+ / −** buttons on the left and right of a node to expand or fold its upstream and downstream connections. Shared resources remain visible while connected through another expanded branch; reopening a branch restores its previous expansions. Graphs are limited to 100 nodes to keep large projects responsive; focus another resource to continue exploring.

Nodes show the resource name and its materialization when available. Hover over or focus a name to see it in full.

Use the minimap to pan or zoom around the graph; use the map button to show or hide it. The header theme button switches between light and dark mode and saves the choice in browser storage.

Use **Export** to download the current expanded graph as SVG, JSON, or Mermaid (`.mmd`). Exports include all displayed nodes, including those outside the current viewport, but exclude folded branches. JSON includes resource metadata and current positions. If the graph hits its 100-node limit, JSON, Mermaid, and SVG mark it as truncated. SVG uses the current theme and a simplified visual style; the full node name is available in its tooltip.

ELK positions the nodes; React Flow draws Bézier edges from shared incoming and outgoing attachment points. Dragging a node keeps its connections attached; expanding or folding a branch recalculates the layout. Curves may cross nodes or other edges in complex graphs.

Connections are dbt **resource dependencies**, not column-level lineage. The manifest and catalog alone do not provide verified column-to-column transformations. Tests are excluded from the graph.

Run focused tests with `npm test`.
