import { webSocketManager } from './webSocketManager';

class OrderTrackingWebSocketService {
    constructor() {
        this.messageQueue = {};
        this.connections = new Map();
    }

    connect(orderId) {
        const wsUrl = `${import.meta.env.VITE_WS_URL}/order/${orderId}/`;
        const connection = this.getConnection(orderId);
        
        if (connection?.socket?.readyState === WebSocket.OPEN) {
            return;
        }

        const newConnection = webSocketManager.createConnection(wsUrl, {
            debug: true,
            maxReconnectAttempts: 5
        });
        
        this.connections.set(orderId, newConnection);
        newConnection.connect();
    }

    getConnection(orderId) {
        const wsUrl = `${import.meta.env.VITE_WS_URL}/order/${orderId}/`;
        return webSocketManager.getConnection(wsUrl);
    }

    disconnect(orderId) {
        const wsUrl = `${import.meta.env.VITE_WS_URL}/order/${orderId}/`;
        webSocketManager.closeConnection(wsUrl);
        this.connections.delete(orderId);
    }

    subscribe(orderId, callback) {
        const connection = this.getConnection(orderId);
        if (connection) {
            return connection.subscribe(callback);
        }
        return () => {};
    }

    sendMessage(orderId, message) {
        const connection = this.getConnection(orderId);
        if (connection) {
            connection.sendMessage(message);
        } else {
            if (!this.messageQueue[orderId]) {
                this.messageQueue[orderId] = [];
            }
            this.messageQueue[orderId].push(message);
            this.connect(orderId);
        }
    }

    updateOrderStatus(orderId, status) {
        this.sendMessage(orderId, {
            type: 'status_update',
            status: status
        });
    }
}

export const orderTrackingWebSocketService = new OrderTrackingWebSocketService();
