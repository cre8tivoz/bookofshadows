import { describe, expect, test } from "vitest";

import { $, $$ } from "../../static/src/ui/dom.js";
import {
  createGraphFeature,
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

describe("graph loading", () => {
  function mountGraphDom() {
    document.body.innerHTML = `
      <div class="graph-wrap"><svg id="graphSvg"><circle class="node"></circle></svg></div>
      <input id="graphQuery" value="">
      <aside id="graphInspector"></aside>
    `;
  }

  test("renders an error state and clears a stale graph when the request fails", async () => {
    mountGraphDom();
    let seenOptions;
    let seenPath;
    const feature = createGraphFeature({
      $,
      $$,
      api: async (path, options) => {
        seenPath = path;
        seenOptions = options;
        throw new Error("graph offline");
      },
      showDetail: () => {},
      switchTab: () => {},
    });

    await feature.loadGraph();

    expect(seenPath).toBe("/api/graph?q=&limit=300");
    expect(seenOptions).toEqual({ requestKey: "graph" });
    expect($("#graphSvg").innerHTML).toBe("");
    const error = $(".graph-wrap .graph-load-error");
    expect(error).not.toBeNull();
    expect(error.querySelector(".state-error")).not.toBeNull();
    expect(error.textContent).toContain("Could not load knowledge graph");
    expect(error.textContent).toContain("graph offline");
  });

  test("clears a previous error state on a successful load", async () => {
    mountGraphDom();
    window.matchMedia = () => ({ matches: false });
    let fail = true;
    const feature = createGraphFeature({
      $,
      $$,
      api: async () => {
        if (fail) throw new Error("temporary failure");
        return { nodes: [], edges: [] };
      },
      showDetail: () => {},
      switchTab: () => {},
    });

    await feature.loadGraph();
    expect($(".graph-wrap .graph-load-error")).not.toBeNull();

    fail = false;
    await feature.loadGraph();
    expect($(".graph-wrap .graph-load-error")).toBeNull();
  });
});
