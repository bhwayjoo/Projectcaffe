import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2 } from "lucide-react";
import { chatWebSocketService } from '@/services/chatWebSocket';
import { useToast } from "@/components/ui/use-toast";
import { formatTime } from '@/lib/utils';

const ChatModal = ({ open, onClose, orderId, onSendMessage }) => {
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
                chatWebSocketService.disconnect();
            };
        }
    }, [open, orderId]);

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
            await onSendMessage(newMessage);
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
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Order #{orderId} Chat</DialogTitle>
                </DialogHeader>
                
                <div 
                    ref={chatContainerRef}
                    className="flex flex-col gap-2 h-[400px] overflow-y-auto p-4 bg-gray-50 rounded-md"
                >
                    {messages.map((msg, index) => (
                        <div
                            key={index}
                            className={`flex flex-col ${
                                msg.sender_type === 'staff' ? 'items-end' : 'items-start'
                            }`}
                        >
                            <div
                                className={`max-w-[80%] rounded-lg p-3 ${
                                    msg.sender_type === 'staff'
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-200 text-gray-800'
                                }`}
                            >
                                <p className="text-sm">{msg.message}</p>
                                <span className="text-xs opacity-75">
                                    {formatTime(msg.timestamp)}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                <form onSubmit={handleSendMessage} className="mt-4">
                    <div className="flex gap-2">
                        <Input
                            type="text"
                            placeholder="Type your message..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            className="flex-1"
                        />
                        <Button type="submit" disabled={isSending}>
                            {isSending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default ChatModal;
