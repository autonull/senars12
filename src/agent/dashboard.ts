import type {Agent, AgentStats} from './agent.js';
import type {Goal} from './GoalManager.js';
import {createServer, type Server} from 'node:http';

export interface DashboardOptions {
    port?: number;
    host?: string;
}

export function createDashboard(agent: Agent, opts: DashboardOptions = {}): {start: () => void; stop: () => void} {
    const port = opts.port ?? 0;
    const host = opts.host ?? '127.0.0.1';
    let server: Server | null = null;

    const statsHtml = (): string => {
        const stats: AgentStats = agent.getStats();
        const goals: readonly Goal[] = agent.getGoals();
        const activeGoal: Goal | undefined = agent.getActiveGoal();
        const metaScore: number | undefined = agent.getMetaScore();
        const approvals: Array<{id: string; request: string; createdAt: number}> = agent.getPendingApprovals();

        const rows: string[] = [
            '<tr><td>Status</td><td class="value">' + (stats.totalChats > 0 ? 'active' : 'idle') + '</td></tr>',
            '<tr><td>Total chats</td><td class="value">' + stats.totalChats + '</td></tr>',
            '<tr><td>Successful</td><td class="value">' + stats.successfulChats + '</td></tr>',
            '<tr><td>Failed</td><td class="value">' + stats.failedChats + '</td></tr>',
            '<tr><td>Success rate</td><td class="value">' + (stats.totalChats > 0 ? (stats.successfulChats / stats.totalChats * 100).toFixed(1) + '%' : 'N/A') + '</td></tr>',
            '<tr><td>Total tokens</td><td class="value">' + stats.totalTokens.toLocaleString() + '</td></tr>',
            '<tr><td>Avg duration</td><td class="value">' + stats.averageDurationMs.toFixed(0) + 'ms</td></tr>',
            '<tr><td>Uptime</td><td class="value">' + formatUptime(Date.now() - stats.startedAt) + '</td></tr>',
            '<tr><td>Active goal</td><td class="value">' + (activeGoal ? escapeHtml(activeGoal.description) + ' (' + (activeGoal.progress * 100).toFixed(0) + '%)' : 'none') + '</td></tr>',
            '<tr><td>Meta score</td><td class="value">' + (metaScore !== undefined ? metaScore.toFixed(3) : 'N/A') + '</td></tr>',
            '<tr><td>Pending approvals</td><td class="value">' + approvals.length + '</td></tr>',
            '<tr><td>Total goals</td><td class="value">' + goals.length + '</td></tr>',
        ];

        const goalRows = goals.map(g => {
            const statusClass = g.status === 'done' ? 'done' : g.status === 'failed' ? 'failed' : g.status === 'active' ? 'active' : '';
            return '<tr class="' + statusClass + '"><td>' + g.id.slice(0, 8) + '</td><td>' + escapeHtml(g.description) + '</td><td>' + g.status + '</td><td>' + (g.progress * 100).toFixed(0) + '%</td><td>' + g.priority + '</td></tr>';
        }).join('\n');

        return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>SeNARS Agent Dashboard</title>
<style>
body{font-family:system-ui,sans-serif;background:#0d1117;color:#c9d1d9;margin:0;padding:20px}
h1{color:#58a6ff;font-size:1.5rem;margin:0 0 20px}
h2{color:#8b949e;font-size:1.1rem;margin:24px 0 8px;border-bottom:1px solid #21262d;padding-bottom:4px}
table{width:100%;border-collapse:collapse;margin-bottom:8px}
td,th{text-align:left;padding:6px 12px;border-bottom:1px solid #21262d;font-size:0.9rem}
th{color:#8b949e;font-weight:500}
.value{font-variant-numeric:tabular-nums;text-align:right;color:#e6edf3}
.done td{color:#3fb950}
.failed td{color:#f85149}
.active td{color:#d29922}
.card{background:#161b22;border:1px solid #30363d;border-radius:6px;padding:16px;margin-bottom:16px}
</style></head>
<body>
<h1>SeNARS Agent Dashboard</h1>
<div class="card"><table>${rows.join('\n')}</table></div>
<div class="card">
<h2>Goal Stack (${goals.length})</h2>
<table><tr><th>ID</th><th>Description</th><th>Status</th><th>Progress</th><th>Priority</th></tr>${goalRows}</table>
</div>
</body></html>`;
    };

    const httpServer = createServer((req, res) => {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        const writeJson = (data: unknown, status = 200) => {
            res.writeHead(status, {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'});
            res.end(JSON.stringify(data, null, 2));
        };

        if (url.pathname === '/health' || url.pathname === '/') {
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(statsHtml());
            return;
        }
        if (url.pathname === '/stats') { writeJson(agent.getStats()); return; }
        if (url.pathname === '/goals') { writeJson({goals: agent.getGoals(), activeGoal: agent.getActiveGoal()}); return; }
        if (url.pathname === '/meta') { writeJson({metaScore: agent.getMetaScore()}); return; }
        if (url.pathname === '/approvals') { writeJson({pendingApprovals: agent.getPendingApprovals()}); return; }
        res.writeHead(404);
        res.end('Not found');
    });

    server = httpServer;
    httpServer.listen(port, host, () => {
        const addr = httpServer.address();
        const actualPort = typeof addr === 'object' && addr ? addr.port : port;
        console.log(`Dashboard: http://${host}:${actualPort}`);
    });

    return {
        start: () => {},
        stop: () => { httpServer.close(); },
    };
}

function formatUptime(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h`;
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
