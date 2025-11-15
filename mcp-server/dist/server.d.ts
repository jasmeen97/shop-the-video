/// <reference types="node" />
import http from 'http';
import { Server } from 'socket.io';
import { config } from './config';
declare const app: import("express-serve-static-core").Express;
declare const server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
declare const io: Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
export { app, server, io };
export { config as serverConfig };
//# sourceMappingURL=server.d.ts.map