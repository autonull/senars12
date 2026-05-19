import {describe, it, expect} from '@jest/globals';
import {PipelineEventEmitter} from '../../src/agent/BotContext.js';

describe('BOT6 Loop-Back', () => {
  it('should have pipeline with loop-back support', () => {
    const emitter = new PipelineEventEmitter();
    
    const events: string[] = [];
    
    emitter.on('turn:start', () => events.push('turn:start'));
    emitter.on('turn:end', () => events.push('turn:end'));
    emitter.on('stage:start', ({ stage }) => events.push(`stage:start:${stage}`));
    
    emitter.emit('turn:start', { input: { id: '1', source: 'test', sender: 'user', text: 'test', timestamp: Date.now() }, passCount: 1 });
    emitter.emit('stage:start', { stage: 'InputNormalizer', passCount: 1 });
    emitter.emit('turn:end', { response: { text: 'test', actions: [] }, durationMs: 10 });
    
    expect(events).toEqual([
      'turn:start',
      'stage:start:InputNormalizer',
      'turn:end',
    ]);
  });

  it('should support event subscription and emission', () => {
    const emitter = new PipelineEventEmitter();
    let eventCount = 0;
    
    emitter.on('classify:result', () => { eventCount++; });
    emitter.emit('classify:result', { input: 'test', classification: { primary: 'chat', confidence: 0.5, signals: [] } });
    emitter.emit('classify:result', { input: 'test', classification: { primary: 'chat', confidence: 0.5, signals: [] } });
    
    expect(eventCount).toBe(2);
  });
});
