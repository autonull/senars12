import {Logger, LoggerFactory} from '../nar/logger/index.js';
import {APIRegistry} from './registry.js';

export abstract class BaseAdapter {
    protected readonly registry: APIRegistry;
    protected readonly logger: Logger;

    constructor(scope: string) {
        this.registry = APIRegistry.getInstance();
        this.logger = LoggerFactory.create({scope});
    }
}