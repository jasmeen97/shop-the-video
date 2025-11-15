export var MCPMessageType;
(function (MCPMessageType) {
    MCPMessageType["SESSION_CREATE"] = "create-session";
    MCPMessageType["SESSION_JOIN"] = "join-session";
    MCPMessageType["SESSION_CREATED"] = "session-created";
    MCPMessageType["SESSION_JOINED"] = "session-joined";
    MCPMessageType["VIEWER_JOINED"] = "viewer-joined";
    MCPMessageType["VIEWER_LEFT"] = "viewer-left";
    MCPMessageType["SESSION_ENDED"] = "session-ended";
    MCPMessageType["SCREEN_DATA"] = "screen-data";
    MCPMessageType["REQUEST_SCREENSHOT"] = "request-screenshot";
    MCPMessageType["SCREENSHOT_DATA"] = "screenshot-data";
    MCPMessageType["START_SCREEN_CAPTURE"] = "start-screen-capture";
    MCPMessageType["SCREEN_CAPTURE_STARTED"] = "screen-capture-started";
    MCPMessageType["STOP_SCREEN_CAPTURE"] = "stop-screen-capture";
    MCPMessageType["SCREEN_CAPTURE_STOPPED"] = "screen-capture-stopped";
    MCPMessageType["ERROR"] = "error";
})(MCPMessageType || (MCPMessageType = {}));
//# sourceMappingURL=protocol.js.map