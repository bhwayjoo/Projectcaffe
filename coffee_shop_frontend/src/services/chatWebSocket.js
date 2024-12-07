class ChatWebSocketService {
    constructor() {
        this.ws = null;
        this.subscribers = new Set();
        this.messageQueue = [];
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectTimeout = null;
        this.currentOrderId = null;
    }

    connect(orderId) {
        if (this.ws?.readyState === WebSocket.OPEN && this.currentOrderId === orderId) {
            console.log('Already connected to the same order chat');
            return;
        }

        // Disconnect if already connected
        if (this.ws) {
            this.disconnect();
        }

        this.currentOrderId = orderId;
        const token = localStorage.getItem('token');
        const wsUrl = `ws://127.0.0.1:8000/ws/chat/${orderId}/?token=${token}`;

        try {
            console.log('Connecting to WebSocket:', wsUrl);
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.processMessageQueue();
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('Received message:', data);
                    this.notifySubscribers(data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.isConnected = false;
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.isConnected = false;
            };
        } catch (error) {
            console.error('Error connecting to WebSocket:', error);
            this.isConnected = false;
            this.attemptReconnect();
        }
    }

    disconnect() {
        if (this.ws) {
            clearTimeout(this.reconnectTimeout);
            this.ws.close();
            this.ws = null;
            this.isConnected = false;
            this.currentOrderId = null;
            this.messageQueue = [];
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
        return new Promise((resolve, reject) => {
            const send = () => {
                try {
                    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                        throw new Error('WebSocket is not connected');
                    }

                    // Ensure message has all required fields
                    const messageToSend = {
                        type: 'chat_message',
                        order_id: this.currentOrderId,
                        message: typeof message === 'string' ? message : message.message,
                        sender_type: 'staff',
                        timestamp: new Date().toISOString(),
                        ...message
                    };

                    console.log('Sending message:', messageToSend);
                    this.ws.send(JSON.stringify(messageToSend));
                    resolve();
                } catch (error) {
                    console.error('Error sending message:', error);
                    reject(error);
                }
            };

            if (!this.isConnected) {
                console.log('WebSocket not connected, queueing message');
                this.messageQueue.push({ message, resolve, reject });
            } else {
                send();
            }
        });
    }

    processMessageQueue() {
        console.log('Processing message queue:', this.messageQueue.length, 'messages');
        while (this.messageQueue.length > 0 && this.isConnected) {
            const { message, resolve, reject } = this.messageQueue.shift();
            this.sendMessage(message).then(resolve).catch(reject);
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts || !this.currentOrderId) {
            console.log('Max reconnection attempts reached or no order ID');
            return;
        }

        const backoffTime = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        console.log(`Attempting to reconnect in ${backoffTime}ms (Attempt ${this.reconnectAttempts + 1})`);

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect(this.currentOrderId);
        }, backoffTime);
    }
}

export const chatWebSocketService = new ChatWebSocketService();
