class MenuWebSocketService {
    constructor() {
        this.ws = null;
        this.subscribers = new Set();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectTimeout = null;
        this.isConnecting = false;
    }

    connect() {
        if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
            return;
        }

        this.isConnecting = true;
        
        try {
            this.ws = new WebSocket('ws://localhost:8000/ws/menu/orders/');
            
            this.ws.onopen = () => {
                console.log('Menu WebSocket connection established');
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                if (this.reconnectTimeout) {
                    clearTimeout(this.reconnectTimeout);
                    this.reconnectTimeout = null;
                }
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.notifySubscribers(data);
                } catch (error) {
                    console.error('Error parsing Menu WebSocket message:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('Menu WebSocket error:', error);
                this.handleConnectionError();
            };

            this.ws.onclose = () => {
                console.log('Menu WebSocket connection closed');
                this.isConnecting = false;
                this.handleConnectionError();
            };
        } catch (error) {
            console.error('Error creating Menu WebSocket connection:', error);
            this.handleConnectionError();
        }
    }

    handleConnectionError() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
            console.log(`Attempting to reconnect menu WebSocket in ${delay/1000} seconds...`);
            
            this.reconnectTimeout = setTimeout(() => {
                this.reconnectAttempts++;
                this.connect();
            }, delay);
        } else {
            console.error('Max reconnection attempts reached');
            this.notifySubscribers({ 
                type: 'connection_error', 
                message: 'Unable to connect to order system' 
            });
        }
    }

    disconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.isConnecting = false;
        this.reconnectAttempts = 0;
    }

    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    notifySubscribers(data) {
        this.subscribers.forEach(callback => callback(data));
    }

    createOrder(orderData) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = JSON.stringify({
                type: 'create_order',
                order: orderData
            });
            this.ws.send(message);
        } else {
            console.error('Menu WebSocket is not connected');
            this.connect(); // Try to reconnect
        }
    }
}

export const menuWebSocketService = new MenuWebSocketService();
