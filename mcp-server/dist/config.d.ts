export declare const config: {
    server: {
        port: string | number;
        cors: {
            origin: string;
            methods: string[];
        };
    };
    sessions: {
        timeoutMs: number;
        cleanupIntervalMs: number;
    };
    stream: {
        maxChunkSize: number;
        maxWidth: number;
        defaultQuality: number;
        maxFps: number;
    };
};
//# sourceMappingURL=config.d.ts.map