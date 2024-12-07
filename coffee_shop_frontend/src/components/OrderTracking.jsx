import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  MessageCircle, 
  Send, 
  QrCode, 
  Smartphone,
  Star 
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { chatWebSocketService } from '@/services/chatWebSocket';
import { ChatModal } from './ui/chat-modal';
import axios from 'axios';
import { QrReader } from 'react-qr-reader';
import { Camera, Wifi, RotateCw } from "lucide-react";

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
  const [showScanner, setShowScanner] = useState(false);
  const [isNfcScanning, setIsNfcScanning] = useState(false);
  const [nfcError, setNfcError] = useState(null);
  const [review, setReview] = useState({ rating: 5, comment: '' });
  const [showChat, setShowChat] = useState(false);
  const cameraStreamRef = useRef(null);
  const hasShownToastRef = useRef(false);
  const previousStatusRef = useRef(null);
  const [cameraError, setCameraError] = useState(null);
  const { toast } = useToast();

  // Fetch initial order data and connect to WebSocket for real-time updates
  useEffect(() => {
    // Initial order fetch
    const fetchOrder = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_URL}/orders/${orderId}/`);
        setOrder(response.data);
        previousStatusRef.current = response.data.status;
        setError(null);
      } catch (err) {
        console.error('Error fetching order:', err);
        setError('Failed to load order details. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();

    // Connect to WebSocket for real-time updates
    const wsUrl = `${WS_URL}/order/${orderId}/`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected for order tracking');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'order_update') {
          setOrder(prevOrder => ({
            ...prevOrder,
            ...data.order
          }));

          // Show notification for status changes
          if (data.order.status !== previousStatusRef.current) {
            toast({
              title: "Order Status Updated",
              description: `Status changed to ${data.order.status}`,
              variant: "default",
            });
            previousStatusRef.current = data.order.status;
          }
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to real-time updates",
        variant: "destructive",
      });
    };

    // Cleanup function
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [orderId, toast]);

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
      setCameraError(null);
      setShowScanner(true);
    } catch (firstError) {
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        cameraStreamRef.current = fallbackStream;
        setCameraError(null);
        setShowScanner(true);
      } catch (error) {
        setCameraError(
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
      handleTableUpdate(tableNumber);
      toast({
        title: "Success",
        description: `Table numéro ${tableNumber} scannée !`,
        variant: "default",
      });
    }
  };

  const handleQrError = (error) => {
    if (error && error?.message !== "No QR code found") {
      setCameraError("Erreur lors de la numérisation QR.");
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
            title: "Success",
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
        title: "Info",
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
      const response = await axios.post(`${API_URL}/orders/${orderId}/update_table/`, {
        table_id: parseInt(tableNumber, 10)  // Changed to table_id as expected by the API
      });
      
      if (response.data.order) {
        setOrder(response.data.order);
        toast({
          title: "Success",
          description: `Table mise à jour : ${tableNumber}`,
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
    if (!order || order.status !== 'confirmed' || order.table_id) {
      return null;
    }

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
          <div className="mt-4">
            <div className="bg-black p-2 rounded-lg">
              <QrReader
                onResult={handleQrScan}
                onError={handleQrError}
                constraints={{ facingMode: 'environment' }}
                className="w-full max-w-sm mx-auto"
              />
            </div>
            <Button
              onClick={() => {
                setShowScanner(false);
                stopCamera();
              }}
              variant="destructive"
              className="w-full mt-2"
            >
              Cancel Scan
            </Button>
          </div>
        )}

        {nfcError && (
          <div className="mt-2 p-3 bg-red-50 text-red-600 rounded-md">
            {nfcError}
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
    if (!order || order.status !== 'delivered' || order.review) {
      return null;
    }

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
            <Textarea
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

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          <p className="mt-4 text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 text-red-600 p-6 rounded-lg">
          <p className="text-lg font-medium">{error}</p>
          <p className="mt-2">Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-gray-600">
          <p className="text-lg">Order not found</p>
          <p className="mt-2">The requested order could not be found.</p>
        </div>
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
              <div className="flex items-center gap-4">
                <OrderStatusBadge status={order.status} />
                <Button
                  onClick={() => setShowChat(true)}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  Chat with Staff
                </Button>
              </div>
            </div>

            <Progress value={ORDER_STATUS_STEPS[order.status] || 0} className="w-full" />
            
            {/* Order Details */}
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Order Details</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p><strong>Status:</strong> {order.status}</p>
                <p><strong>Table:</strong> {order.table || 'Not assigned'}</p>
                <p><strong>Total:</strong> ${order.total_amount}</p>

                {/* Table Change Section */}
                <div className="mt-8">
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex gap-4 flex-wrap justify-center">
                      <Button
                        onClick={startScanner}
                        className="flex items-center gap-2"
                      >
                        <Camera className="w-4 h-4" />
                        Scanner le QR code
                      </Button>
                      <Button
                        onClick={startNfcScan}
                        disabled={isNfcScanning}
                        className="flex items-center gap-2"
                      >
                        <Wifi className="w-4 h-4" />
                        {isNfcScanning ? "Lecture NFC..." : "Scanner NFC"}
                      </Button>
                    </div>

                    {nfcError && (
                      <Alert variant="destructive" className="mt-4">
                        <AlertDescription>{nfcError}</AlertDescription>
                      </Alert>
                    )}
                    {nfcError && (
                      <Alert variant="destructive" className="mt-4">
                        <AlertDescription>{nfcError}</AlertDescription>
                      </Alert>
                    )}

                    {showScanner && (
                      <div className="relative w-full max-w-md mx-auto">
                        <QrReader
                          constraints={{ facingMode: "environment" }}
                          onResult={(result, error) => {
                            if (result) handleQrScan(result);
                            if (error) handleQrError(error);
                          }}
                          className="w-full aspect-square rounded-lg overflow-hidden"
                        />
                        <Button
                          onClick={() => {
                            stopCamera();
                            setShowScanner(false);
                          }}
                          variant="secondary"
                          className="mt-4 w-full"
                        >
                          Annuler le scan
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {renderTableSelection()}
            {renderReviewForm()}
          </div>
        </div>
      </div>

      {/* Chat Modal */}
      <ChatModal
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        orderId={orderId}
      />
    </div>
  );
};

export default OrderTracking;
