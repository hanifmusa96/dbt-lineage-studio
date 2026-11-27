import test from "node:test";
import assert from "node:assert/strict";
import { layoutLineage } from "../../features/lineage/utils/layout.ts";

test("lays out an isolated node", async () => {
    const layout = await layoutLineage({ ids: ["root"], edges: [] });
    assert.equal(layout.nodes.length, 1);
    assert.deepEqual(layout.nodes[0].ports, []);
});

test("connects a fan-out at one point", async () => {
    const targets = Array.from({ length: 10 }, (_, i) => `target${i}`);
    const layout = await layoutLineage({
        ids: ["root", ...targets],
        edges: targets.map((target) => ({ source: "root", target })),
    });
    const root = layout.nodes.find((node) => node.id === "root");
    assert.ok(root);
    const outgoing = root.ports.filter((port) => port.type === "source");
    assert.equal(outgoing.length, 10);
    assert.ok(outgoing.every((port) => port.y === root.height / 2));
    for (const edge of layout.edges) {
        assert.ok(outgoing.some((port) => port.id === edge.sourcePort));
        const target = layout.nodes.find((node) => node.id === edge.target);
        assert.ok(target);
        assert.ok(target.ports.some((port) => port.id === edge.targetPort && port.y === target.height / 2));
    }
});

test("connects fan-in edges to one point after relayout", async () => {
    const sources = ["a", "b", "c"];
    const edges = sources.map((source) => ({ source, target: "root" }));
    for (const selectedEdges of [edges, edges.slice(0, 2)]) {
        const layout = await layoutLineage({ ids: ["root", ...sources], edges: selectedEdges });
        const root = layout.nodes.find((node) => node.id === "root");
        assert.ok(root);
        const incoming = root.ports.filter((port) => port.type === "target");
        assert.ok(incoming.every((port) => port.y === root.height / 2));
        for (const edge of layout.edges) {
            assert.ok(incoming.some((port) => port.id === edge.targetPort));
        }
    }
});
