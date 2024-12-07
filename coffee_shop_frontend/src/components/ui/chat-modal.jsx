import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, MessageCircle } from "lucide-react";
import { chatWebSocketService } from '@/services/chatWebSocket';
import { useToast } from "@/components/ui/use-toast";

export const ChatModal = ({ isOpen, onClose, orderId }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const chatContainerRef = useRef(null);
    const { toast } = useToast();

    useEffect(() => {
        if (isOpen && orderId) {
            // Connect to WebSocket when modal opens
            chatWebSocketService.connect(orderId);

            // Subscribe to messages
            const unsubscribe = chatWebSocketService.subscribe((data) => {
                if (data.type === 'chat_message') {
                    setMessages(prev => {
                        // Check if message already exists to prevent duplicates
                        const exists = prev.some(msg => 
                            msg.timestamp === data.timestamp && 
                            msg.message === data.message &&
                            msg.sender_type === data.sender_type
                        );
                        if (!exists) {
                            return [...prev, {
                                message: data.message,
                                sender_type: data.sender_type,
                                timestamp: data.timestamp,
                                is_read: data.is_read
                            }];
                        }
                        return prev;
                    });
                }
            });

            // Scroll to bottom on new messages
            if (chatContainerRef.current) {
                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
            }

            return () => {
                unsubscribe();
                if (!isOpen) {
                    chatWebSocketService.disconnect();
                }
            };
        }
    }, [isOpen, orderId]);

    // Auto-scroll when new messages arrive
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || isSending) return;

        try {
            setIsSending(true);
            await chatWebSocketService.sendMessage(newMessage);
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

    const formatTime = (timestamp) => {
        try {
            return new Date(timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } catch (error) {
            return '';
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Chat with Staff - Order #{orderId}</DialogTitle>
                </DialogHeader>
                
                <div 
                    ref={chatContainerRef}
                    className="flex flex-col space-y-4 h-[400px] overflow-y-auto p-4"
                >
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                            <p>No messages yet. Start the conversation!</p>
                        </div>
                    ) : (
                        messages.map((msg, index) => (
                            <div
                                key={index}
                                className={`flex ${
                                    msg.sender_type === 'client' ? 'justify-end' : 'justify-start'
                                }`}
                            >
                                <div
                                    className={`max-w-[80%] p-3 rounded-lg ${
                                        msg.sender_type === 'client'
                                            ? 'bg-blue-500 text-white ml-auto'
                                            : 'bg-gray-100 text-gray-800'
                                    }`}
                                >
                                    <p className="break-words">{msg.message}</p>
                                    <span className={`text-xs mt-1 block ${
                                        msg.sender_type === 'client' 
                                            ? 'text-blue-100' 
                                            : 'text-gray-500'
                                    }`}>
                                        {formatTime(msg.timestamp)}
                                    </span>
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
                            disabled={isSending}
                            className="flex-1"
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
