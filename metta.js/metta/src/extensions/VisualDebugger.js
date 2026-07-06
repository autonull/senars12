/**
 * VisualDebugger.js - MORK-parity Phase P4-A: Visual Debugging
 * DOT/JSON export, tensor heatmaps, gradient tracking
 */

import {isExpression} from '../kernel/Term.js';

export class VisualDebugger {
    constructor() {
        this.traces = [];
        this.tensorActivations = [];
        this.tensorGradients = [];
        this.nodeId = 0;
        this.enabled = false;
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (enabled) {
            this.traces = [];
            this.tensorActivations = [];
            this.tensorGradients = [];
        }
    }

    recordStep(from, to, rule, bindings) {
        if (!this.enabled) {
            return;
        }
        this.traces.push({
            id: this.nodeId++,
            from: this._serializeTerm(from),
            to: this._serializeTerm(to),
            rule: rule ? this._serializeTerm(rule.pattern) : null,
            bindings: bindings ? this._serializeBindings(bindings) : null,
            timestamp: Date.now()
        });
    }

    recordTensorActivation(name, tensor, layer = 'unknown') {
        if (!this.enabled) {
            return;
        }
        this.tensorActivations.push({
            id: this.nodeId++, name, layer,
            shape: tensor.shape || [],
            data: tensor.data ? Array.from(tensor.data) : [],
            timestamp: Date.now()
        });
    }

    recordTensorGradient(name, gradient, layer = 'unknown') {
        if (!this.enabled) {
            return;
        }
        this.tensorGradients.push({
            id: this.nodeId++, name, layer,
            shape: gradient.shape || [],
            data: gradient.data ? Array.from(gradient.data) : [],
            timestamp: Date.now()
        });
    }

    _serializeTerm(term) {
        if (!term) {
            return null;
        }
        if (typeof term === 'string' || typeof term === 'number') {
            return {type: 'literal', value: term};
        }
        if (term.name !== undefined && !term.components) {
            return {type: 'symbol', name: term.name};
        }
        if (isExpression(term)) {
            return {
                type: 'expression',
                operator: this._serializeTerm(term.operator),
                components: (term.components || []).map(c => this._serializeTerm(c))
            };
        }
        return {type: 'unknown', value: String(term)};
    }

    _serializeBindings(bindings) {
        if (!bindings) {
            return null;
        }
        const result = {};
        if (bindings instanceof Map) {
            for (const [k, v] of bindings.entries()) {
                result[k] = this._serializeTerm(v);
            }
        } else {
            for (const k of Object.keys(bindings)) {
                result[k] = this._serializeTerm(bindings[k]);
            }
        }
        return result;
    }

    exportDOT() {
        const lines = ['digraph ReductionTrace {', '  rankdir=TB;', '  node [shape=box, fontname="Helvetica", fontsize=10];', '  edge [fontname="Helvetica", fontsize=8];', ''];
        for (const trace of this.traces) {
            const fromId = `n${trace.id}_from`;
            const toId = `n${trace.id}_to`;
            lines.push(`  ${fromId} [label="${this._escapeDOT(this._termLabel(trace.from))}"];`);
            lines.push(`  ${toId} [label="${this._escapeDOT(this._termLabel(trace.to))}"];`);
            lines.push(`  ${fromId} -> ${toId} [label="${this._escapeDOT(trace.rule ? this._termLabel(trace.rule) : 'step')}"];`);
            lines.push('');
        }
        lines.push('}');
        return lines.join('\n');
    }

    exportJSON() {
        return JSON.stringify({
            traces: this.traces,
            tensorActivations: this.tensorActivations,
            tensorGradients: this.tensorGradients,
            exportedAt: new Date().toISOString()
        }, null, 2);
    }

    exportTensorHeatmaps() {
        if (typeof document === 'undefined') {
            return this.tensorActivations.map(act => ({
                name: act.name, layer: act.layer, shape: act.shape,
                dataUrl: this._tensorToDataUrl(act.data, act.shape)
            }));
        }
        return this.tensorActivations.map(act => {
            const container = document.createElement('div');
            container.innerHTML = `<h4>${act.name} (${act.layer})</h4>`;
            container.appendChild(this._renderTensorHeatmap(act.data, act.shape));
            return container;
        });
    }

    _renderTensorHeatmap(data, shape) {
        const canvas = document.createElement('canvas');
        if (shape.length === 1) {
            canvas.width = Math.max(200, shape[0] * 4);
            canvas.height = 40;
            this._render1DHeatmap(canvas, data, shape);
        } else if (shape.length === 2) {
            canvas.width = Math.max(100, shape[1] * 10);
            canvas.height = Math.max(100, shape[0] * 10);
            this._render2DHeatmap(canvas, data, shape);
        } else {
            canvas.width = Math.max(200, data.length * 2);
            canvas.height = 40;
            this._render1DHeatmap(canvas, data, [data.length]);
        }
        return canvas;
    }

    _render1DHeatmap(canvas, data, shape) {
        const ctx = canvas.getContext('2d');
        const [min, max, range] = [Math.min(...data), Math.max(...data), Math.max(...data) - Math.min(...data) || 1];
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        data.forEach((val, i) => {
            ctx.fillStyle = this._heatmapColor((val - min) / range);
            ctx.fillRect(i * (canvas.width / data.length), 10, canvas.width / data.length - 1, canvas.height - 20);
        });
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Helvetica';
        ctx.fillText(`[${min.toFixed(3)}, ${max.toFixed(3)}]`, 5, canvas.height - 5);
    }

    _render2DHeatmap(canvas, data, shape) {
        const ctx = canvas.getContext('2d');
        const [rows, cols] = shape;
        const [cellWidth, cellHeight] = [canvas.width / cols, canvas.height / rows];
        const [min, max, range] = [Math.min(...data), Math.max(...data), Math.max(...data) - Math.min(...data) || 1];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                ctx.fillStyle = this._heatmapColor((data[r * cols + c] - min) / range);
                ctx.fillRect(c * cellWidth, r * cellHeight, cellWidth - 1, cellHeight - 1);
            }
        }
    }

    _heatmapColor(normalized) {
        return `rgb(${Math.floor(255 * normalized)}, 50, ${Math.floor(255 * (1 - normalized))})`;
    }

    _tensorToDataUrl(data, shape) {
        const [min, max, avg] = [Math.min(...data), Math.max(...data), data.reduce((a, b) => a + b, 0) / data.length];
        return `data:text/plain,shape=[${shape}],min=${min.toFixed(4)},max=${max.toFixed(4)},avg=${avg.toFixed(4)}`;
    }

    _termLabel(term) {
        if (!term) {
            return '()';
        }
        if (term.type === 'literal') {
            return String(term.value);
        }
        if (term.type === 'symbol') {
            return term.name;
        }
        if (term.type === 'expression') {
            const op = this._termLabel(term.operator);
            return `${op}(${term.components.slice(0, 3).map(c => this._termLabel(c)).join(',')}${term.components.length > 3 ? '...' : ''})`;
        }
        return '?';
    }

    _escapeDOT(str) {
        return String(str).replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/</g, '\\<').replace(/>/g, '\\>');
    }

    getStats() {
        return {
            reductionSteps: this.traces.length,
            tensorActivations: this.tensorActivations.length,
            tensorGradients: this.tensorGradients.length,
            uniqueTerms: new Set(this.traces.map(t => JSON.stringify(t.from))).size
        };
    }

    clear() {
        this.traces = [];
        this.tensorActivations = [];
        this.tensorGradients = [];
        this.nodeId = 0;
    }

    hookTensorBackward(tensor) {
        if (!this.enabled || !tensor) {
            return tensor;
        }
        const originalBackward = tensor.backward;
        if (originalBackward) {
            tensor.backward = (...args) => {
                this.recordTensorGradient(tensor.name || 'unknown', tensor.grad || tensor.data, tensor.layer || 'unknown');
                return originalBackward.call(tensor, ...args);
            };
        }
        return tensor;
    }
}

export const visualDebugger = new VisualDebugger();
