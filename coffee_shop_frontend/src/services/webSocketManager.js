class WebSocketManager {
    constructor() {
        this.connections = new Map();
        this.defaultConfig = {
            maxReconnectAttempts: 5,
            baseReconnectDelay: 1000,
            maxReconnectDelay: 10000,
            debug: false
        };
    }

    createConnection(url, config = {}) {
        if (this.connections.has(url)) {
            return this.connections.get(url);
        }

        const connection = new WebSocketConnection(url, {
            ...this.defaultConfig,
            ...config
        });
        this.connections.set(url, connection);
        return connection;
    }

    getConnection(url) {
        return this.connections.get(url);
    }

    closeConnection(url) {
        const connection = this.connections.get(url);
        if (connection) {
            connection.disconnect();
            this.connections.delete(url);
        }
    }

    closeAll() {
        this.connections.forEach(connection => connection.disconnect());
        this.connections.clear();
    }
}

class WebSocketConnection {
    constructor(url, config) {
        this.url = url;
        this.config = config;
        this.socket = null;
        this.subscribers = new Set();
        this.reconnectAttempts = 0;
        this.messageQueue = [];
        this.connecting = false;
        this.heartbeatInterval = null;
        this.lastHeartbeat = null;
    }

    connect() {
        if (this.socket?.readyState === WebSocket.OPEN || this.connecting) {
            return;
        }

        this.connecting = true;
        try {
            this.socket = new WebSocket(this.url);
            this.setupSocketHandlers();
            this.startHeartbeat();
        } catch (error) {
            this.log('Error creating WebSocket:', error);
            this.handleConnectionError();
        }
    }

    setupSocketHandlers() {
        this.socket.onopen = () => {
            this.log('Connection established');
            this.connecting = false;
            this.reconnectAttempts = 0;
            this.processMessageQueue();
            this.notifySubscribers({ type: 'connection_status', status: 'connected' });
        };

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'heartbeat') {
                    this.lastHeartbeat = Date.now();
                    return;
                }
                this.notifySubscribers(data);
            } catch (error) {
                this.log('Error processing message:', error);
            }
        };

        this.socket.onclose = (event) => {
            this.log('Connection closed:', event);
            this.cleanup();
            if (!event.wasClean) {
                this.handleConnectionError();
            }
            this.notifySubscribers({ type: 'connection_status', status: 'disconnected' });
        };

        this.socket.onerror = (error) => {
            this.log('WebSocket error:', error);
            this.handleConnectionError();
        };
    }

    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatInterval = setInterval(() => {
            if (this.socket?.readyState === WebSocket.OPEN) {
                this.sendMessage({ type: 'heartbeat' });
                
                // Check if we haven't received a heartbeat in a while
                const now = Date.now();
                if (this.lastHeartbeat && now - this.lastHeartbeat > 30000) {
                    this.log('No heartbeat received, reconnecting...');
                    this.reconnect();
                }
            }
        }, 15000);
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    handleConnectionError() {
        if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(
                this.config.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
                this.config.maxReconnectDelay
            );
            this.log(`Reconnecting in ${delay/1000} seconds... (Attempt ${this.reconnectAttempts})`);
            setTimeout(() => this.connect(), delay);
        } else {
            this.log('Max reconnection attempts reached');
            this.notifySubscribers({
                type: 'connection_error',
                message: 'Connection lost. Please refresh the page.'
            });
        }
    }

    reconnect() {
        this.disconnect();
        this.connect();
    }

    disconnect() {
        this.cleanup();
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }

    cleanup() {
        this.connecting = false;
        this.stopHeartbeat();
    }

    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    notifySubscribers(data) {
        this.subscribers.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                this.log('Error in subscriber callback:', error);
            }
        });
    }

    sendMessage(message) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            this.messageQueue.push(message);
            this.connect();
            return;
        }

        try {
            this.socket.send(JSON.stringify(message));
        } catch (error) {
            this.log('Error sending message:', error);
            this.messageQueue.push(message);
            this.handleConnectionError();
        }
    }

    processMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.sendMessage(message);
        }
    }

    log(...args) {
        if (this.config.debug) {
            console.log(`[WebSocket:${this.url}]`, ...args);
        }
    }
}

class WebSocketService {
    constructor() {
        this.socket = null;
        this.subscribers = new Set();
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectTimeout = null;
    }

    connect() {
        if (this.socket?.readyState === WebSocket.OPEN) {
            console.log('WebSocket already connected');
            return;
        }

        try {
            this.socket = new WebSocket('ws://127.0.0.1:8000/ws/orders/');

            this.socket.onopen = () => {
                console.log('WebSocket connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.notifySubscribers({
                    type: 'connection_status',
                    status: 'connected'
                });
            };

            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.notifySubscribers(data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            this.socket.onclose = () => {
                console.log('WebSocket disconnected');
                this.isConnected = false;
                this.notifySubscribers({
                    type: 'connection_status',
                    status: 'disconnected'
                });
                this.attemptReconnect();
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.notifySubscribers({
                    type: 'connection_error',
                    message: 'Connection error occurred'
                });
            };
        } catch (error) {
            console.error('Error creating WebSocket:', error);
            this.attemptReconnect();
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            this.reconnectTimeout = setTimeout(() => {
                this.connect();
            }, Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000));
        } else {
            console.log('Max reconnection attempts reached');
            this.notifySubscribers({
                type: 'connection_error',
                message: 'Unable to establish connection'
            });
        }
    }

    subscribe(callback) {
        this.subscribers.add(callback);
        return () => {
            this.subscribers.delete(callback);
        };
    }

    notifySubscribers(data) {
        this.subscribers.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('Error in subscriber callback:', error);
            }
        });
    }

    sendMessage(message) {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        } else {
            console.error('WebSocket is not connected');
            this.attemptReconnect();
        }
    }
}

const webSocketManager = new WebSocketManager();
export { webSocketManager };
