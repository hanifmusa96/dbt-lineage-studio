import test from "node:test";
import assert from "node:assert/strict";
import { bezierRoute, layoutLineage } from "./layout.js";

test("renders routed bends as cubic curves and preserves endpoints", () => {
    const path = bezierRoute({
        startPoint: { x: 0, y: 0 },
        bendPoints: [{ x: 40, y: 0 }, { x: 40, y: 30 }],
        endPoint: { x: 80, y: 30 },
    });
    assert.match(path, /^M 0 0 L /);
    assert.equal((path.match(/ C /g) || []).length, 2);
    assert.match(path, / L 80 30$/);
    assert.doesNotMatch(path, /NaN|Infinity/);
});

test("handles straight routes and duplicate bend points", () => {
    const path = bezierRoute({
        startPoint: { x: 0, y: 0 },
        bendPoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }],
        endPoint: { x: 10, y: 10 },
    });
    assert.match(path, / C /);
    assert.match(path, / L 10 10$/);
    assert.doesNotMatch(path, /NaN|Infinity/);
    assert.equal(bezierRoute({ startPoint: { x: 0, y: 1 }, endPoint: { x: 4, y: 1 } }), "M 0 1 L 4 1");
});

test("connects a fan-out at one point while keeping distinct routes", async () => {
    const targets = Array.from({ length: 10 }, (_, i) => `target${i}`);
    const layout = await layoutLineage({
        ids: ["root", ...targets],
        edges: targets.map((target) => ({ source: "root", target })),
    });
    const root = layout.nodes.find((node) => node.id === "root");
    const outgoing = root.ports.filter((port) => port.type === "source");
    assert.equal(outgoing.length, 10);
    assert.ok(outgoing.every((port) => port.y === root.height / 2));
    assert.ok(layout.edges.every((edge) => edge.sourcePoint.x === root.x + root.width && edge.sourcePoint.y === root.y + root.height / 2));
    assert.equal(new Set(layout.edges.map((edge) => edge.route.startPoint.y)).size, 10);
    const paths = layout.edges.map((edge) => bezierRoute(edge.route, edge.sourcePoint, edge.targetPoint));
    assert.equal(new Set(paths).size, 10);
    assert.ok(paths.every((path) => path.startsWith(`M ${root.x + root.width} ${root.y + root.height / 2} `)));
    for (const edge of layout.edges) {
        assert.ok(edge.route.startPoint);
        assert.ok(edge.route.endPoint);
    }
});

test("connects fan-in edges to one point and keeps routes after relayout", async () => {
    const sources = ["a", "b", "c"];
    const edges = sources.map((source) => ({ source, target: "root" }));
    for (const selectedEdges of [edges, edges.slice(0, 2)]) {
        const layout = await layoutLineage({ ids: ["root", ...sources], edges: selectedEdges });
        const root = layout.nodes.find((node) => node.id === "root");
        const incoming = root.ports.filter((port) => port.type === "target");
        assert.ok(incoming.every((port) => port.y === root.height / 2));
        for (const edge of layout.edges) {
            assert.deepEqual(edge.targetPoint, { x: root.x, y: root.y + root.height / 2 });
            assert.ok(bezierRoute(edge.route, edge.sourcePoint, edge.targetPoint).endsWith(`${root.x} ${root.y + root.height / 2}`));
        }
    }
});

test("routes crossing dependencies around nodes", async () => {
    const layout = await layoutLineage({
        ids: ["a", "b", "c", "d"],
        edges: [
            { source: "a", target: "b" },
            { source: "a", target: "c" },
            { source: "b", target: "d" },
            { source: "c", target: "d" },
            { source: "a", target: "d" },
        ],
    });
    for (const { route } of layout.edges) {
        const points = [route.startPoint, ...(route.bendPoints || []), route.endPoint];
        for (let i = 1; i < points.length; i++) {
            const a = points[i - 1];
            const b = points[i];
            assert.ok(a.x === b.x || a.y === b.y);
            for (const node of layout.nodes) {
                const crosses =
                    a.x === b.x
                        ? a.x > node.x &&
                          a.x < node.x + node.width &&
                          Math.max(a.y, b.y) > node.y &&
                          Math.min(a.y, b.y) < node.y + node.height
                        : a.y > node.y &&
                          a.y < node.y + node.height &&
                          Math.max(a.x, b.x) > node.x &&
                          Math.min(a.x, b.x) < node.x + node.width;
                assert.equal(crosses, false, `Edge crosses ${node.id}`);
            }
        }
    }
});
