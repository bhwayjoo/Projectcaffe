import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { useToast } from "./ui/use-toast";
import { QrReader } from 'react-qr-reader';
import { Camera, Wifi, Star, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";

const API_URL = 'http://127.0.0.1:8000/api';
const WS_URL = 'ws://127.0.0.1:8000/ws';

const NFC_TABLE_MAPPING = {
  "43:66:75:f3": "1",
  "e3:18:4f:f3": "2",
  "d6:7f:94:0e": "3",
  "30:e7:21:01": "4"
};

const ORDER_STATUS_STEPS = {
  'pending': 0,
  'confirmed': 25,
  'preparing': 50,
  'ready': 75,
  'delivered': 100
};

// Helper functions moved outside components
const getStatusColor = (status) => {
  if (!status) return 'bg-gray-100 text-gray-800 border-gray-300';
  
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    confirmed: 'bg-blue-100 text-blue-800 border-blue-300',
    preparing: 'bg-purple-100 text-purple-800 border-purple-300',
    ready: 'bg-green-100 text-green-800 border-green-300',
    delivered: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    cancelled: 'bg-red-100 text-red-800 border-red-300',
  };
  return colors[status.toLowerCase()] || 'bg-gray-100 text-gray-800 border-gray-300';
};

const getStatusEmoji = (status) => {
  if (!status) return '❓';
  
  const emojis = {
    pending: '⏳',
    confirmed: '✅',
    preparing: '👨‍🍳',
    ready: '🍽️',
    delivered: '🎉',
    cancelled: '❌',
  };
  return emojis[status.toLowerCase()] || '❓';
};

const OrderStatusBadge = ({ status }) => {
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(status)} flex items-center gap-2`}>
      <span>{getStatusEmoji(status)}</span>
      <span>{status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : 'Unknown'}</span>
    </span>
  );
};

const OrderTracking = () => {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ws, setWs] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [isNfcScanning, setIsNfcScanning] = useState(false);
  const [nfcError, setNfcError] = useState(null);
  const [review, setReview] = useState({ rating: 5, comment: '' });
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const cameraStreamRef = useRef(null);
  const chatRef = useRef(null);
  const hasShownToastRef = useRef(false);
  const previousStatusRef = useRef(null);
  const { toast } = useToast();
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Fetch initial order data
  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await axios.get(`${API_URL}/orders/${orderId}/`);
        setOrder(response.data);
        previousStatusRef.current = response.data.status;
      } catch (err) {
        setError(err.message);
        toast({
          title: "Error",
          description: "Failed to load order details",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  // Handle WebSocket connection and messages
  useEffect(() => {
    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_DELAY = 3000;
    let reconnectAttempts = 0;

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        return;
      }

      const socket = new WebSocket(`${WS_URL}/order/${orderId}/`);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log('WebSocket connected');
        setError(null);
        reconnectAttempts = 0;
      };

      socket.onmessage = (event) => {
        handleWebSocketMessage(event.data);
      };

      socket.onclose = (event) => {
        console.log('WebSocket closed:', event);
        
        if (!event.wasClean && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          console.log(`Reconnecting... Attempt ${reconnectAttempts}`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY);
        } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          setError('Connection lost. Please refresh the page.');
          toast({
            title: "Connection Lost",
            description: "Please refresh the page to reconnect",
            variant: "destructive",
          });
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Connection error. Please check your internet connection.');
      };

      setWs(socket);
    };

    connect();

    // Cleanup function
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [orderId]);

  // Handle order status changes
  useEffect(() => {
    if (order?.status && previousStatusRef.current !== order.status) {
      previousStatusRef.current = order.status;
    }
  }, [order?.status]);

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
  };

  const startScanner = async () => {
    try {
      const constraints = {
        video: {
          facingMode: { exact: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraStreamRef.current = stream;
      setNfcError(null);
      setShowScanner(true);
    } catch (firstError) {
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        cameraStreamRef.current = fallbackStream;
        setNfcError(null);
        setShowScanner(true);
      } catch (error) {
        setNfcError(
          error.name === "NotAllowedError"
            ? "Accès à la caméra refusé. Veuillez autoriser l'accès à la caméra."
            : "Impossible d'accéder à la caméra."
        );
        toast({
          title: "Error",
          description: "Accès à la caméra requis pour la numérisation QR",
          variant: "destructive",
        });
      }
    }
  };

  const handleQrScan = (result) => {
    if (result) {
      const tableNumber = result.text;
      setShowScanner(false);
      stopCamera();
      if (!hasShownToastRef.current) {
        toast({
          title: "Table Scanned",
          description: `Table numéro ${tableNumber} scannée !`,
          variant: "default",
        });
        hasShownToastRef.current = true;
      }
      handleTableUpdate(tableNumber);
    }
  };

  const handleQrError = (error) => {
    if (error && error?.message !== "No QR code found") {
      setNfcError("Erreur lors de la numérisation QR.");
    }
  };

  const startNfcScan = async () => {
    if (!("NDEFReader" in window)) {
      setNfcError("NFC n'est pas supporté sur cet appareil");
      toast({
        title: "Error",
        description: "NFC non supporté",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsNfcScanning(true);
      setNfcError(null);

      const ndef = new window.NDEFReader();
      await ndef.scan();

      ndef.addEventListener("reading", ({ serialNumber }) => {
        const mappedTable = NFC_TABLE_MAPPING[serialNumber];
        if (mappedTable) {
          handleTableUpdate(mappedTable);
          toast({
            title: "Table Identified",
            description: `Table ${mappedTable} identifiée !`,
            variant: "default",
          });
        } else {
          toast({
            title: "Error",
            description: "Badge non reconnu",
            variant: "destructive",
          });
        }
        setIsNfcScanning(false);
      });

      ndef.addEventListener("error", () => {
        setNfcError("Erreur lors de la lecture NFC");
        setIsNfcScanning(false);
        toast({
          title: "Error",
          description: "Erreur de lecture NFC",
          variant: "destructive",
        });
      });

      toast({
        title: "Scan NFC",
        description: "Approchez votre badge NFC...",
        variant: "default",
      });
    } catch (error) {
      setNfcError(
        error.name === "NotAllowedError"
          ? "Accès NFC refusé. Veuillez l'activer dans les paramètres."
          : "Erreur lors de l'initialisation NFC"
      );
      setIsNfcScanning(false);
      toast({
        title: "Error",
        description: "Erreur NFC",
        variant: "destructive",
      });
    }
  };

  const handleTableUpdate = async (tableNumber) => {
    try {
      console.log('Updating table to:', tableNumber);
      
      const response = await axios.post(`${API_URL}/orders/${orderId}/update_table/`, {
        table_id: parseInt(tableNumber, 10)
      });
      
      console.log('Server response:', response.data);
      
      if (response.data.order) {
        setOrder(response.data.order);
        toast({
          title: "Table Updated",
          description: "Table mise à jour avec succès",
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Error updating table:', error);
      const errorMessage = error.response?.data?.error || 'Échec de la mise à jour de la table';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const renderTableSelection = () => {
    return (
      <div className="mt-4 space-y-4">
        <h3 className="text-lg font-semibold">Changer de Table</h3>
        
        {nfcError && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md">
            {nfcError}
          </div>
        )}

        <div className="flex space-x-4">
          <Button
            onClick={startScanner}
            disabled={showScanner}
            className="flex items-center gap-2"
          >
            <Camera className="w-4 h-4" />
            Scanner QR Code
          </Button>

          <Button
            onClick={startNfcScan}
            disabled={isNfcScanning}
            className="flex items-center gap-2"
          >
            <Wifi className="w-4 h-4" />
            Scanner NFC
          </Button>
        </div>

        {showScanner && (
          <div className="relative">
            <QrReader
              onResult={handleQrScan}
              onError={handleQrError}
              constraints={{ facingMode: 'environment' }}
              className="w-full max-w-sm mx-auto"
            />
            <Button
              onClick={() => {
                setShowScanner(false);
                stopCamera();
              }}
              className="mt-2 text-red-600 hover:text-red-800"
            >
              Annuler le scan
            </Button>
          </div>
        )}
      </div>
    );
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!order || order.status !== 'delivered') {
        toast({
          title: "Error",
          description: "Can only review delivered orders",
          variant: "destructive",
        });
        return;
      }

      if (order.review) {
        toast({
          title: "Error",
          description: "Order already has a review",
          variant: "destructive",
        });
        return;
      }

      const response = await axios.post(`${API_URL}/orders/${orderId}/review/`, {
        rating: parseInt(review.rating),
        comment: review.comment || ''
      });

      toast({
        title: "Review Submitted",
        description: "Review submitted successfully!",
        variant: "default",
      });
      setReview({ rating: 5, comment: '' });
      
      setOrder(prevOrder => ({
        ...prevOrder,
        review: response.data
      }));
    } catch (error) {
      console.error('Error submitting review:', error);
      const errorMessage = error.response?.data?.error || 'Failed to submit review';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const StarRating = () => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setReview({ ...review, rating: star })}
            className={`focus:outline-none ${
              star <= review.rating ? 'text-yellow-400' : 'text-gray-300'
            }`}
          >
            <Star
              className={`w-6 h-6 ${
                star <= review.rating ? 'fill-yellow-400' : 'fill-none'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  const renderReviewForm = () => {
    if (!order || order.status !== 'delivered' || order.review) return null;

    return (
      <div className="mt-6 p-4 bg-white rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Leave a Review</h3>
        <form onSubmit={handleReviewSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rating
            </label>
            <StarRating />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comment
            </label>
            <textarea
              value={review.comment}
              onChange={(e) => setReview({ ...review, comment: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              rows="3"
              placeholder="Share your experience..."
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            Submit Review
          </Button>
        </form>
      </div>
    );
  };

  const handleWebSocketMessage = (data) => {
    try {
      const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
      console.log('Parsed WebSocket message:', parsedData);

      switch (parsedData.type) {
        case 'order_data':
        case 'order_update':
          if (parsedData.order) {
            setOrder(prevOrder => {
              // Only update and show toast if status has changed
              if (prevOrder?.status !== parsedData.order.status) {
                const emoji = getStatusEmoji(parsedData.order.status);
                toast({
                  title: "Order Status Updated",
                  description: `${emoji} Status: ${parsedData.order.status.toUpperCase()}`,
                  variant: "default",
                });
              }
              return parsedData.order;
            });
          }
          break;

        case 'chat_message':
          if (parsedData.message) {
            setMessages(prev => [...prev, {
              message: parsedData.message,
              sender_type: parsedData.sender_type,
              timestamp: parsedData.timestamp
            }]);

            // Play notification sound for customer messages
            if (parsedData.sender_type === 'staff') {
              const audio = new Audio('/notification.mp3');
              audio.play().catch(e => console.log('Audio play failed:', e));
            }
          }
          break;

        case 'error':
          console.error('WebSocket error message:', parsedData.message);
          setError(parsedData.message);
          toast({
            title: "Error",
            description: parsedData.message,
            variant: "destructive",
          });
          break;

        default:
          console.log('Unknown message type:', parsedData.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !ws || ws.readyState !== WebSocket.OPEN || isSending) return;

    try {
      setIsSending(true);
      const messageData = {
        type: 'chat_message',
        message: newMessage.trim(),
        sender_type: 'customer',
        timestamp: new Date().toISOString()
      };

      // Only send to server and wait for echo
      ws.send(JSON.stringify(messageData));
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

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  if (loading) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading order details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-6 rounded-lg">
        <p className="text-lg font-medium">{error}</p>
        <p className="mt-2">Please try refreshing the page.</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center text-gray-600">
        <p className="text-lg">Order not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Order #{orderId}</h2>
              <OrderStatusBadge status={order.status} />
            </div>
            
            <Progress
              value={ORDER_STATUS_STEPS[order.status] || 0}
              className="w-full"
            />

            {renderTableSelection()}
            {renderReviewForm()}
          </div>
        </div>
      </div>
      
      {/* Chat Section */}
      <div className="mt-8 bg-white rounded-lg shadow-lg">
        <div className="border-b p-4 bg-gray-50">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <span>Chat with Staff</span>
            {ws?.readyState === WebSocket.OPEN && (
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm text-gray-600 font-normal">Connected</span>
              </div>
            )}
            {ws?.readyState !== WebSocket.OPEN && (
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-red-500 rounded-full" />
                <span className="text-sm text-gray-600 font-normal">Disconnected</span>
              </div>
            )}
          </h2>
        </div>
        
        <div 
          ref={chatRef}
          className="h-[400px] p-4 overflow-y-auto space-y-3 bg-gray-50"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-center">
                No messages yet. Start the conversation!
              </p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${
                  msg.sender_type === 'customer' ? 'justify-end' : 'justify-start'
                } items-end space-x-2 mb-3`}
              >
                {msg.sender_type !== 'customer' && (
                  <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
                    <span className="text-white text-sm font-semibold">S</span>
                  </div>
                )}
                <div
                  className={`relative max-w-[70%] break-words p-3 rounded-lg ${
                    msg.sender_type === 'customer'
                      ? 'bg-blue-500 text-white rounded-br-none'
                      : 'bg-green-600 text-white rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm">{msg.message}</p>
                  <span className={`text-xs mt-1 block ${
                    msg.sender_type === 'customer' ? 'text-blue-100' : 'text-white opacity-75'
                  }`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                {msg.sender_type === 'customer' && (
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-white text-sm font-semibold">Y</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <form onSubmit={sendMessage} className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-gray-50 focus:bg-white transition-colors"
              disabled={!ws || ws.readyState !== WebSocket.OPEN}
            />
            <Button 
              type="submit" 
              disabled={!ws || ws.readyState !== WebSocket.OPEN || !newMessage.trim() || isSending}
              className="bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300"
            >
              {isSending ? (
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Sending...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <span>Send</span>
                </div>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrderTracking;
