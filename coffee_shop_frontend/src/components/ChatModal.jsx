import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Loader2, Send, Check, CheckCheck } from "lucide-react";
import { chatWebSocketService } from '../services/chatWebSocket';
import { useToast } from "./ui/use-toast";
import { formatTime } from '../lib/utils';

const ChatModal = ({ open, onClose, orderId }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const chatContainerRef = useRef(null);
    const { toast } = useToast();

    useEffect(() => {
        if (open && orderId) {
            // Connect to WebSocket when modal opens
            chatWebSocketService.connect(orderId);

            // Subscribe to messages
            const unsubscribe = chatWebSocketService.subscribe((data) => {
                if (data.type === 'chat_message') {
                    setMessages(prev => {
                        // Check if message already exists
                        const exists = prev.some(msg => 
                            msg.timestamp === data.timestamp && 
                            msg.message === data.message &&
                            msg.sender_type === data.sender_type
                        );
                        if (!exists) {
                            // Play notification sound for new customer messages
                            if (data.sender_type === 'customer') {
                                const audio = new Audio('/notification.mp3');
                                audio.play().catch(e => console.log('Audio play failed:', e));
                            }
                            return [...prev, data];
                        }
                        return prev;
                    });
                } else if (data.type === 'chat_history') {
                    setMessages(data.messages || []);
                }
            });

            return () => {
                unsubscribe();
                chatWebSocketService.disconnect();
                setMessages([]);
            };
        }
    }, [open, orderId]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || isSending) return;

        setIsSending(true);
        try {
            const messageData = {
                type: 'chat_message',
                message: newMessage.trim(),
                sender_type: 'staff',
                order_id: orderId,
                timestamp: new Date().toISOString()
            };

            await chatWebSocketService.sendMessage(messageData);
            setNewMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
            toast({
                title: "Error",
                description: "Failed to send message. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Chat - Order #{orderId}</DialogTitle>
                </DialogHeader>

                <div 
                    ref={chatContainerRef}
                    className="flex flex-col gap-2 h-[400px] overflow-y-auto p-4 bg-gray-50 rounded-md"
                >
                    {messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            <p>No messages yet</p>
                        </div>
                    ) : (
                        messages.map((msg, index) => (
                            <div
                                key={index}
                                className={`flex ${msg.sender_type === 'staff' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-lg p-3 ${
                                        msg.sender_type === 'staff'
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-gray-200 text-gray-800'
                                    }`}
                                >
                                    <p className="text-sm break-words">{msg.message}</p>
                                    <div className="flex items-center justify-end gap-1 mt-1">
                                        <span className={`text-xs ${
                                            msg.sender_type === 'staff' ? 'text-blue-100' : 'text-gray-500'
                                        }`}>
                                            {formatTime(msg.timestamp)}
                                        </span>
                                        {msg.sender_type === 'staff' && (
                                            msg.is_read ? (
                                                <CheckCheck className="h-3 w-3 text-blue-100" />
                                            ) : (
                                                <Check className="h-3 w-3 text-blue-100" />
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <form onSubmit={handleSendMessage} className="mt-4">
                    <div className="flex gap-2">
                        <Input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type your message..."
                            className="flex-1"
                            disabled={isSending}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage(e);
                                }
                            }}
                        />
                        <Button 
                            type="submit" 
                            disabled={isSending || !newMessage.trim()}
                            className="flex items-center gap-2"
                        >
                            {isSending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                            Send
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default ChatModal;
