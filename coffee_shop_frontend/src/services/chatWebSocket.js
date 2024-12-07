import { webSocketManager } from './webSocketManager';

class ChatWebSocketService {
    constructor() {
        this.currentOrderId = null;
        this.messageQueue = [];
    }

    connect(orderId) {
        if (this.currentOrderId === orderId && this.getConnection()?.socket?.readyState === WebSocket.OPEN) {
            return;
        }

        // Disconnect from previous order if any
        if (this.currentOrderId && this.currentOrderId !== orderId) {
            this.disconnect();
        }

        this.currentOrderId = orderId;
        const wsUrl = `ws://127.0.0.1:8000/ws/order/${orderId}/`;
        
        const connection = webSocketManager.createConnection(wsUrl, {
            debug: true,
            maxReconnectAttempts: 5
        });

        connection.connect();
    }

    getConnection() {
        if (!this.currentOrderId) return null;
        return webSocketManager.getConnection(`ws://127.0.0.1:8000/ws/order/${this.currentOrderId}/`);
    }

    sendMessage(message) {
        const connection = this.getConnection();
        if (connection) {
            connection.sendMessage(message);
        } else {
            console.error('No active WebSocket connection');
            this.messageQueue.push(message);
        }
    }

    subscribe(callback) {
        const connection = this.getConnection();
        if (connection) {
            return connection.subscribe(callback);
        }
        return () => {};
    }

    disconnect() {
        if (this.currentOrderId) {
            const wsUrl = `ws://127.0.0.1:8000/ws/order/${this.currentOrderId}/`;
            webSocketManager.closeConnection(wsUrl);
            this.currentOrderId = null;
            this.messageQueue = [];
        }
    }

    isConnected() {
        const connection = this.getConnection();
        return connection?.socket?.readyState === WebSocket.OPEN;
    }
}

export const chatWebSocketService = new ChatWebSocketService();
