class ChatWebSocketService {
    constructor() {
        this.ws = null;
        this.subscribers = new Set();
        this.messageQueue = [];
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectTimeout = null;
        this.pingInterval = null;
        this.currentOrderId = null;
    }

    connect(orderId) {
        if (this.ws && this.currentOrderId === orderId) {
            return; // Already connected to the same order
        }

        // Disconnect if connected to a different order
        if (this.ws) {
            this.disconnect();
        }

        this.currentOrderId = orderId;
        const wsUrl = `${import.meta.env.VITE_WS_URL}/chat/${orderId}/`;

        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.startPingInterval();
                this.processMessageQueue();
                
                // Request chat history
                this.sendMessage({
                    type: 'get_history',
                    order_id: orderId
                });
            };

            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                console.log('Received message:', data);
                
                if (data.type === 'chat_history') {
                    // Handle chat history
                    data.messages.forEach(msg => {
                        this.notifySubscribers({
                            type: 'chat_message',
                            ...msg
                        });
                    });
                } else {
                    this.notifySubscribers(data);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.isConnected = false;
                this.stopPingInterval();
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.isConnected = false;
            };

        } catch (error) {
            console.error('Error connecting to WebSocket:', error);
            this.attemptReconnect();
        }
    }

    disconnect() {
        if (this.ws) {
            this.stopPingInterval();
            clearTimeout(this.reconnectTimeout);
            this.ws.close();
            this.ws = null;
            this.isConnected = false;
            this.currentOrderId = null;
            this.messageQueue = [];
            this.subscribers.clear();
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

    async sendMessage(message) {
        if (typeof message === 'string') {
            message = {
                type: 'chat_message',
                message: message,
                sender_type: 'client',
                timestamp: new Date().toISOString()
            };
        }

        if (!this.isConnected) {
            this.messageQueue.push(message);
            return;
        }

        try {
            this.ws.send(JSON.stringify(message));
        } catch (error) {
            console.error('Error sending message:', error);
            this.messageQueue.push(message);
            throw error;
        }
    }

    processMessageQueue() {
        while (this.messageQueue.length > 0 && this.isConnected) {
            const message = this.messageQueue.shift();
            try {
                this.ws.send(JSON.stringify(message));
            } catch (error) {
                console.error('Error processing queued message:', error);
                this.messageQueue.unshift(message); // Put the message back
                break;
            }
        }
    }

    startPingInterval() {
        this.stopPingInterval();
        this.pingInterval = setInterval(() => {
            if (this.isConnected) {
                try {
                    this.ws.send(JSON.stringify({ type: 'ping' }));
                } catch (error) {
                    console.error('Error sending ping:', error);
                    this.attemptReconnect();
                }
            }
        }, 30000); // Send ping every 30 seconds
    }

    stopPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Max reconnection attempts reached');
            return;
        }

        const backoffTime = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectTimeout = setTimeout(() => {
            console.log(`Attempting to reconnect... (Attempt ${this.reconnectAttempts + 1})`);
            this.reconnectAttempts++;
            this.connect(this.currentOrderId);
        }, backoffTime);
    }
}

export const chatWebSocketService = new ChatWebSocketService();
