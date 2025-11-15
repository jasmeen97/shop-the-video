export const config = {
    server: {
        port: process.env.PORT || 3000,
        cors: {
            origin: process.env.CORS_ORIGIN || '*',
            methods: ['GET', 'POST']
        }
    },
    sessions: {
        timeoutMs: 3600000,
        cleanupIntervalMs: 300000 // Check for expired sessions every 5 minutes
    },
    stream: {
        maxChunkSize: 1024 * 1024,
        maxWidth: 1920,
        defaultQuality: 80,
        maxFps: 10 // Maximum frames per second
    }
};
//# sourceMappingURL=config.js.map