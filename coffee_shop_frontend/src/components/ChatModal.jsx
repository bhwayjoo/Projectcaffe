import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/customAcios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Loader2, Send, X } from 'lucide-react';
import { chatWebSocketService } from '../services/chatWebSocket';
import { useToast } from './ui/use-toast';

const ChatModal = ({ orderId, isOpen, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`/chat/messages/?order_id=${orderId}`);
      setMessages(response.data);
      scrollToBottom();
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Error",
        description: "Failed to load chat messages",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && orderId) {
      fetchMessages();
      
      // Connect to WebSocket
      chatWebSocketService.connect(orderId);
      setIsConnected(true);
      
      const handleWebSocketMessage = (data) => {
        if (data.type === 'chat_message') {
          setMessages(prevMessages => [...prevMessages, {
            id: Date.now(),
            message: data.message,
            sender_type: data.sender_type,
            timestamp: data.timestamp,
            is_read: data.is_read
          }]);
          scrollToBottom();
          
          // Show notification for customer messages
          if (data.sender_type === 'customer') {
            toast({
              title: "New Message",
              description: `Customer: ${data.message}`,
              variant: "default",
            });
          }
        }
      };
      
      const unsubscribe = chatWebSocketService.subscribe(handleWebSocketMessage);

      return () => {
        unsubscribe();
        chatWebSocketService.disconnect();
        setIsConnected(false);
      };
    }
  }, [isOpen, orderId, toast]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !isConnected) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    
    try {
      chatWebSocketService.sendMessage({
        type: 'chat_message',
        message: messageText,
        sender_type: 'admin',
        order_id: orderId
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
      setNewMessage(messageText); // Restore message if send fails
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4 shadow-xl">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Order #{orderId}</h3>
            {isConnected && (
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full" 
                    title="Connected" />
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 rounded-full p-1 hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="p-4 h-96 overflow-y-auto bg-gray-50">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex justify-center items-center h-full text-gray-500">
              No messages yet
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, index) => (
                <div
                  key={msg.id || index}
                  className={`flex ${
                    msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] break-words p-3 rounded-lg ${
                      msg.sender_type === 'admin'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white border border-gray-200'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                    <span className={`text-xs mt-1 block ${
                      msg.sender_type === 'admin' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                      {msg.is_read && msg.sender_type === 'admin' && (
                        <span className="ml-2">✓</span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSendMessage} className="p-4 border-t bg-white rounded-b-lg">
          <div className="flex gap-2">
            <Input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1"
              disabled={!isConnected}
            />
            <Button 
              type="submit" 
              disabled={!isConnected || !newMessage.trim()}
              variant="default"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatModal;
