export interface ConfigProvider {
    get<T>(key: string, fallback: T): T;
    getRequired<T>(key: string): T;
    has(key: string): boolean;
}

type ConfigSource = () => Record<string, unknown>;

export class ConfigLoader {
    private sources: ConfigSource[] = [];

    addSource(source: ConfigSource): this {
        this.sources.push(source);
        return this;
    }

    load<T extends Record<string, unknown>>(schema: {parse: (data: unknown) => T}): T {
        const merged = this.sources.reduce<Record<string, unknown>>(
            (acc, source) => ({...acc, ...source()}),
            {}
        );
        return schema.parse(merged);
    }
}
