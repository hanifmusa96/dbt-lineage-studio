# Lineage Studio

A local dbt lineage explorer inspired by dbt-colibri. It uses React Flow and ELK to display resource-level dependencies from `manifest.json`, enriched with column metadata from `catalog.json`.

## Run

1. Generate dbt artifacts with `dbt compile` and `dbt docs generate`, or use existing artifacts.
2. Place `manifest.json` and `catalog.json` in `target/`.
3. Run `npm install` and `npm run dev`. Open the local URL printed by Vite.

The app loads the two local files automatically. You can also import another pair using **Import artifacts**; those files are read in your browser and are not persisted. The development and preview servers bind to localhost. `npm run build` builds the frontend; `npm run preview` serves it with the same local-artifact endpoints. A separately hosted static build can use the import dialog instead.

Search for a resource, select it to focus its graph, and click a graph node for metadata. Use the **+ / −** buttons on the left and right of a node to expand or fold its upstream and downstream connections. Shared resources remain visible while connected through another expanded branch; reopening a branch restores its previous expansions. Graphs are limited to 100 nodes to keep large projects responsive; focus another resource to continue exploring.

Nodes show the resource name and its materialization when available. Hover over or focus a name to see it in full.

ELK routes connections around nodes with shared incoming and outgoing attachment points and curved Bézier bends. Dragging a node keeps its connections attached; expanding or folding a branch recalculates the layout and routes.

Connections are dbt **resource dependencies**, not column-level lineage. The manifest and catalog alone do not provide verified column-to-column transformations. Tests are excluded from the graph.

Run focused tests with `npm test`.
