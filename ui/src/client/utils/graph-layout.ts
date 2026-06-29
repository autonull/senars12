import type {Core} from 'cytoscape';
import type {ChatMessage} from '../../shared/protocol.js';

export function layoutConversationThread(cy: Core, messages: ChatMessage[]): void {
    const threadNodes = cy
        .nodes('[nodeType="message"]')
        .sort((a, b) => (a.data('layout')?.threadIndex ?? 0) - (b.data('layout')?.threadIndex ?? 0));

    const baseX = 0,
        baseY = -200,
        spacing = 180;
    threadNodes.forEach((node, i) => {
        node.position({x: baseX, y: baseY + i * spacing});
        if (i > 0) {
            const prev = threadNodes[i - 1];
            if (prev && cy.getElementById(`thread_${prev.id()}_${node.id()}`).empty()) {
                cy.add({
                    group: 'edges',
                    data: {
                        id: `thread_${prev.id()}_${node.id()}`,
                        source: prev.id(),
                        target: node.id(),
                        type: 'thread',
                        directed: true,
                    },
                    classes: 'thread-edge',
                });
            }
        }
    });
}
