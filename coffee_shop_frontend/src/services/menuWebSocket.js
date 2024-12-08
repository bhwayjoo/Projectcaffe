import { webSocketManager } from './webSocketManager';

class MenuWebSocketService {
    constructor() {
        this.wsUrl = `${import.meta.env.VITE_WS_URL}/menu-orders/`;
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
            console.error('Menu WebSocket is not connected');
            this.connect();
        }
    }

    isConnected() {
        const connection = this.getConnection();
        return connection?.socket?.readyState === WebSocket.OPEN;
    }
}

export const menuWebSocketService = new MenuWebSocketService();
