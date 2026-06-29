import type {Page} from '@playwright/test';

export class PerfMonitor {
    constructor(private page: Page) {
    }

    async start() {
        await this.page.evaluate(() => {
            (window as any).__frameTimes = [];
            let last = performance.now();
            const loop = () => {
                const now = performance.now();
                (window as any).__frameTimes.push(now - last);
                last = now;
                requestAnimationFrame(loop);
            };
            requestAnimationFrame(loop);
        });

        await this.page.evaluate(() => {
            (window as any).__nodeCountHistory = [];
            setInterval(() => {
                (window as any).__nodeCountHistory.push(document.getElementsByTagName('*').length);
            }, 1000);
        });
    }

    async assertWithinBudget() {
        const frameTimes = await this.page.evaluate(() => (window as any).__frameTimes || []);
        const nodeCounts = await this.page.evaluate(() => (window as any).__nodeCountHistory || []);

        const drops = frameTimes.filter((t: number) => t > 33);
        const severeDrops = frameTimes.filter((t: number) => t > 100);

        if (severeDrops.length > 5) {
            throw new Error(
                `Performance degradation: ${severeDrops.length} severe frame drops (>100ms). ` +
                `Worst: ${Math.max(...severeDrops).toFixed(2)}ms`
            );
        }

        if (drops.length > frameTimes.length * 0.1) {
            throw new Error(
                `Excessive frame drops: ${((drops.length / frameTimes.length) * 100).toFixed(1)}% of frames exceeded 33ms`
            );
        }

        if (nodeCounts.length > 10) {
            const startNodes = nodeCounts[0];
            const endNodes = nodeCounts[nodeCounts.length - 1];
            const growth = (endNodes - startNodes) / startNodes;

            if (growth > 0.2) {
                throw new Error(
                    `Potential memory leak: DOM node count grew by ${(growth * 100).toFixed(1)}% ` +
                    `(${startNodes} → ${endNodes} nodes)`
                );
            }
        }
    }
}
