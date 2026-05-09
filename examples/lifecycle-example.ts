/**
 * Example: Component Lifecycle Management
 *
 * Demonstrates the new BaseComponent lifecycle and DI container
 */

import {NAR} from '../nar/nar.js';
import {Container} from '../nar/lifecycle/Container.js';
import {createLogger} from '../nar/logger/index.js';
import {MetricsCollector} from '../nar/metrics/index.js';
import {EventBus} from '../nar/types/index.js';

async function basicLifecycle() {
    console.log('=== Basic Component Lifecycle ===\n');

    const nar = new NAR({
        maxConcepts: 100,
        priorityThreshold: 0.5
    });

    console.log('State after creation:', nar.state);

    await nar.initialize();
    console.log('State after initialization:', nar.state);

    await nar.start();
    console.log('State after start:', nar.state);

    await nar.believe('(apple --> fruit).');
    await nar.believe('(fruit --> edible).');

    const derived = await nar.run(5);
    console.log(`Derived ${derived} conclusions`);

    await nar.stop();
    console.log('State after stop:', nar.state);

    await nar.dispose();
    console.log('State after dispose:', nar.state);
}

async function dependencyInjection() {
    console.log('\n=== Dependency Injection ===\n');

    const container = new Container();

    const logger = createLogger({scope: 'App'});
    const metrics = new MetricsCollector();
    const eventBus = new EventBus();

    container.register({
        name: 'logger',
        type: 'value',
        value: logger
    });

    container.register({
        name: 'metrics',
        type: 'value',
        value: metrics
    });

    container.register({
        name: 'eventBus',
        type: 'value',
        value: eventBus
    });

    container.register({
        name: 'nar',
        type: 'component',
        dependencies: ['logger', 'metrics', 'eventBus'],
        factory: () => new NAR({
            maxConcepts: 100,
            priorityThreshold: 0.5
        })
    });

    await container.initialize('nar');
    console.log('NAR initialized via DI');

    await container.start('nar');
    console.log('NAR started via DI');

    const nar = container.get<NAR>('nar');
    await nar.believe('(bird --> animal).');
    await nar.believe('(animal --> moves).');

    const derived = await nar.run(3);
    console.log(`Derived ${derived} conclusions`);

    await container.dispose('nar');
    console.log('NAR disposed via DI');
}

async function lifecycleValidation() {
    console.log('\n=== Lifecycle Validation ===\n');

    const nar = new NAR();

    try {
        await nar.start();
    } catch (error: any) {
        console.log('Expected error:', error.message);
    }

    await nar.initialize();
    console.log('Initialized successfully');

    await nar.start();
    console.log('Started successfully');

    try {
        await nar.initialize();
    } catch (error: any) {
        console.log('Expected error:', error.message);
    }

    await nar.dispose();
    console.log('Disposed successfully');
}

async function main() {
    try {
        await basicLifecycle();
        await dependencyInjection();
        await lifecycleValidation();
        console.log('\n✅ All lifecycle examples completed!');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export {basicLifecycle, dependencyInjection, lifecycleValidation};
