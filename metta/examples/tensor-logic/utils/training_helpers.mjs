import {T} from '../../../core/src/functor/backends/NativeBackend.js';

export function createDataset(fn, numSamples) {
    return Array.from({length: numSamples}, (_, i) => fn(i));
}

export function trainLoop(model, dataloader, lossFn, optimizer, epochs, callbacks = {}) {
    const {onEpochEnd, afterBatch, shouldStop} = callbacks;

    for (let epoch = 0; epoch < epochs; epoch++) {
        let epochLoss = 0, correct = 0, total = 0;

        for (const batch of dataloader) {
            optimizer.zeroGrad(model.parameters());

            if (Array.isArray(batch)) {
                batch.forEach(sample => {
                    const {input, target, label} = sample;
                    const pred = model.forward(input);
                    const loss = lossFn(pred, target);
                    epochLoss += loss.item?.() ?? loss.data[0];

                    if (label !== undefined && pred.size === 1) {
                        if (Math.round(pred.data[0]) === label) correct++;
                        total++;
                    }

                    loss.backward();
                });
            }

            optimizer.step(model.parameters());
            afterBatch?.(epoch, batch);
        }

        const metrics = {loss: epochLoss / dataloader.length, accuracy: total > 0 ? correct / total : null};

        onEpochEnd?.(epoch, metrics);

        if (shouldStop?.(epoch, metrics)) break;
    }
}

export function visualizeGrid(points, width = 40, height = 15, range = [0, 7]) {
    const grid = Array(height).fill().map(() => Array(width).fill(' '));
    const [min, max] = range;

    points.forEach(({x, y, label, char}) => {
        const px = Math.floor((x - min) / (max - min) * (width - 1));
        const py = height - 1 - Math.floor((y - min) / (max - min) * (height - 1));
        if (py >= 0 && py < height && px >= 0 && px < width) {
            grid[py][px] = char ?? (label === 0 ? '○' : '●');
        }
    });

    grid.forEach(row => console.log('│' + row.join('') + '│'));
    console.log('└' + '─'.repeat(width) + '┘');
}

export function visualizeDecisionBoundary(model, width = 40, height = 15, range = [0, 7], dataPoints = []) {
    const grid = Array(height).fill().map(() => Array(width).fill(' '));
    const [min, max] = range;

    for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
            const x = min + px / (width - 1) * (max - min);
            const y = max - py / (height - 1) * (max - min);
            const pred = model.forward(T.tensor([[x, y]]));
            grid[py][px] = pred.data[0] > 0.5 ? '▓' : '░';
        }
    }

    dataPoints.forEach(({x, y, label}) => {
        const px = Math.floor((x - min) / (max - min) * (width - 1));
        const py = height - 1 - Math.floor((y - min) / (max - min) * (height - 1));
        if (py >= 0 && py < height && px >= 0 && px < width) {
            grid[py][px] = label === 0 ? '○' : '●';
        }
    });

    grid.forEach(row => console.log('│' + row.join('') + '│'));
    console.log('└' + '─'.repeat(width) + '┘');
}

export function printMetrics(epoch, metrics, config = {}) {
    const {pad = 3, decimals = 4, prefix = 'Epoch'} = config;
    const parts = [`${prefix} ${String(epoch).padStart(pad)}`];

    for (const [key, value] of Object.entries(metrics)) {
        if (value === null || value === undefined) continue;
        const formatted = typeof value === 'number'
            ? value.toFixed(decimals)
            : value;
        parts.push(`${key}=${formatted}`);
    }

    console.log(parts.join(', '));
}
