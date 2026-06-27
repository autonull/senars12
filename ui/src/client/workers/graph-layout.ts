import cytoscape, { type Core } from 'cytoscape';

let cy: Core | null = null;

self.onmessage = function (e: MessageEvent): void {
  const { nodes, edges } = e.data;
  if (cy === null) {
    cy = cytoscape({ headless: true, elements: [] });
  }
  const c = cy!;
  c.batch(() => {
    c.elements().remove();
    c.add(nodes.map((n: any) => ({ group: 'nodes', data: n })));
    c.add(edges.map((e: any) => ({ group: 'edges', data: e })));
  });
  const layout = c.layout({ name: 'cose', animate: false, randomize: false });
  layout.run();
  layout.one('layoutstop', () => {
    const positions: Record<string, { x: number; y: number }> = {};
    c.nodes().forEach((n: any) => { positions[n.id()] = n.position(); });
    self.postMessage({ positions });
  });
};
