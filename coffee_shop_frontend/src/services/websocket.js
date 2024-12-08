import { webSocketManager } from './webSocketManager';

class WebSocketService {
    constructor() {
        this.messageQueue = [];
        this.wsUrl = `${import.meta.env.VITE_WS_URL}/orders/`;
    }

    connect() {
        const connection = this.getConnection();
        if (connection?.socket?.readyState === WebSocket.OPEN) {
            return;
        }

        const newConnection = webSocketManager.createConnection(this.wsUrl, {
            debug: true,
            maxReconnectAttempts: 5
        });
        
        newConnection.connect();
    }

    getConnection() {
        return webSocketManager.getConnection(this.wsUrl);
    }

    disconnect() {
        webSocketManager.closeConnection(this.wsUrl);
    }

    subscribe(callback) {
        const connection = this.getConnection();
        if (connection) {
            return connection.subscribe(callback);
        }
        return () => {};
    }

    sendMessage(message) {
        const connection = this.getConnection();
        if (connection) {
            connection.sendMessage(message);
        } else {
            this.messageQueue.push(message);
            this.connect();
        }
    }

    updateOrderStatus(orderId, status) {
        this.sendMessage({
            type: 'update_status',
            order_id: orderId,
            status: status
        });
    }

    isConnected() {
        const connection = this.getConnection();
        return connection?.socket?.readyState === WebSocket.OPEN;
    }
}

export const webSocketService = new WebSocketService();
