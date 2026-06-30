import { describe, expect, test } from "vitest";

import {
  graphEdgeInspectorHtml,
  graphLayout,
  graphNodeInspectorHtml,
  graphQueryPath,
} from "../../static/src/features/graph.js";

describe("graph feature helpers", () => {
  const graph = {
    nodes: [
      { id: "a", label: "Alpha <node>", count: 9 },
      { id: "b", label: "Beta node", count: 1 },
      { id: "c", label: "Gamma node", count: 4 },
    ],
    edges: [
      { id: "e1", source: "a", target: "b", subject: "Alpha", predicate: "knows", object: "Beta", confidence: 0.8 },
      { id: "e2", source: "missing", target: "b", subject: "Ghost", predicate: "haunts", object: "Beta" },
    ],
  };

  test("builds an encoded graph query path with the fixed graph limit", () => {
    expect(graphQueryPath("alpha pact")).toBe("/api/graph?q=alpha%20pact&limit=300");
    expect(graphQueryPath("")).toBe("/api/graph?q=&limit=300");
  });

  test("lays out visible graph nodes and filters edges to visible endpoints", () => {
    const layout = graphLayout(graph);

    expect(layout.nodes).toHaveLength(3);
    expect(layout.edges.map((edge) => edge.id)).toEqual(["e1"]);
    expect(layout.byId.a.label).toBe("Alpha <node>");
    expect(layout.nodes[0]).toMatchObject({ id: "a" });
    expect(typeof layout.nodes[0].x).toBe("number");
    expect(typeof layout.nodes[0].y).toBe("number");
  });

  test("renders escaped node inspector html with connected edge rows", () => {
    const layout = graphLayout(graph);
    const html = graphNodeInspectorHtml(layout.nodes[0], layout.edges);

    expect(html).toContain("Selected node");
    expect(html).toContain("Alpha &lt;node&gt;");
    expect(html).toContain("1 connected triple");
    expect(html).toContain('data-edge="e1"');
    expect(html).toContain("Show in Triples");
  });

  test("renders escaped edge inspector html", () => {
    const html = graphEdgeInspectorHtml({
      subject: "Alpha <subject>",
      predicate: "knows",
      object: "Beta",
      confidence: 0.8,
      created_at: "2026-07-01",
    });

    expect(html).toContain("Selected triple");
    expect(html).toContain("Alpha &lt;subject&gt;");
    expect(html).toContain("Confidence: 0.8");
    expect(html).toContain("Inspect JSON");
  });
});
