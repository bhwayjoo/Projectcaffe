import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { QrReader } from 'react-qr-reader';
import { Camera, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";

const NFC_TABLE_MAPPING = {
  "43:66:75:f3": "1",
  "e3:18:4f:f3": "2",
  "d6:7f:94:0e": "3",
  "30:e7:21:01": "4",
};

const OrderStatusBadge = ({ status }) => {
  const getStatusColor = (status) => {
    if (!status) return 'bg-gray-100 text-gray-800 border-gray-300';
    
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      preparing: 'bg-blue-100 text-blue-800 border-blue-300',
      ready: 'bg-green-100 text-green-800 border-green-300',
      delivered: 'bg-purple-100 text-purple-800 border-purple-300',
      cancelled: 'bg-red-100 text-red-800 border-red-300',
    };
    return colors[status.toLowerCase()] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(status)}`}>
      {status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : 'Unknown'}
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
  const [cameraError, setCameraError] = useState(null);
  const [isNfcScanning, setIsNfcScanning] = useState(false);
  const [nfcError, setNfcError] = useState(null);
  const cameraStreamRef = useRef(null);
  const hasShownToastRef = useRef(false);

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
        toast.error("Accès à la caméra requis pour la numérisation QR");
      }
    }
  };

  const handleQrScan = (result) => {
    if (result) {
      const tableNumber = result.text;
      setShowScanner(false);
      stopCamera();
      if (!hasShownToastRef.current) {
        toast.success(`Table numéro ${tableNumber} scannée !`);
        hasShownToastRef.current = true;
      }
      handleTableUpdate(tableNumber);
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
      toast.error("NFC non supporté");
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
          toast.success(`Table ${mappedTable} identifiée !`);
        } else {
          toast.error("Badge non reconnu");
        }
        setIsNfcScanning(false);
      });

      ndef.addEventListener("error", () => {
        setNfcError("Erreur lors de la lecture NFC");
        setIsNfcScanning(false);
        toast.error("Erreur de lecture NFC");
      });

      toast.success("Approchez votre badge NFC...");
    } catch (error) {
      setNfcError(
        error.name === "NotAllowedError"
          ? "Accès NFC refusé. Veuillez l'activer dans les paramètres."
          : "Erreur lors de l'initialisation NFC"
      );
      setIsNfcScanning(false);
      toast.error("Erreur NFC");
    }
  };

  // Function to update table
  const handleTableUpdate = async (tableNumber) => {
    try {
      console.log('Updating table to:', tableNumber);
      
      const response = await axios.post(`http://127.0.0.1:8000/api/orders/${orderId}/update_table/`, {
        table_id: parseInt(tableNumber, 10)
      });
      
      console.log('Server response:', response.data);
      
      if (response.data.order) {
        setOrder(response.data.order);
        toast.success('Table mise à jour avec succès');
      }
    } catch (error) {
      console.error('Error updating table:', error);
      const errorMessage = error.response?.data?.error || 'Échec de la mise à jour de la table';
      toast.error(errorMessage);
    }
  };

  // Render table selection UI
  const renderTableSelection = () => {
    return (
      <div className="mt-4 space-y-4">
        <h3 className="text-lg font-semibold">Changer de Table</h3>
        
        {cameraError && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md">
            {cameraError}
          </div>
        )}

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

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await axios.get(`http://127.0.0.1:8000/api/orders/${orderId}/track/`);
        console.log('Order data received:', response.data);
        setOrder(response.data);
      } catch (error) {
        console.error('Error fetching order:', error);
        setError('Failed to load order details');
        toast.error('Failed to load order details');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();

    const wsUrl = `ws://127.0.0.1:8000/ws/order/${orderId}/`;
    console.log('Connecting to WebSocket:', wsUrl);
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log('WebSocket connected successfully');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);
        
        if (data.type === 'order_update' && data.order) {
          setOrder(currentOrder => {
            // Only show toast if status has changed
            if (currentOrder && currentOrder.status !== data.order.status) {
              toast.info(`Order status updated to: ${data.order.status}`);
            }
            return data.order;
          });
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast.error('Connection error. Status updates may be delayed.');
    };

    socket.onclose = (event) => {
      console.log('WebSocket connection closed:', event);
      if (!event.wasClean) {
        toast.warning('Lost connection to server. Refresh to reconnect.');
      }
    };

    setWs(socket);

    return () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [orderId]);

  const updateOrderStatus = async (newStatus) => {
    try {
      await axios.post(`http://127.0.0.1:8000/api/orders/${orderId}/update_status/`, {
        status: newStatus
      });
      toast.success('Order status updated successfully');
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
    }
  };

  const handleCancel = async () => {
    try {
      await axios.post(`http://127.0.0.1:8000/api/orders/${orderId}/cancel/`);
      toast.success('Order cancelled successfully');
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error('Failed to cancel order');
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`http://127.0.0.1:8000/api/orders/${orderId}/review/`, review);
      toast.success('Review submitted successfully!');
      setReview({ rating: 5, comment: '' }); // Reset form
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Failed to submit review');
    }
  };

  if (loading) {
    return (
      <div className="max-w-lg mx-auto p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-40 bg-gray-200 rounded mb-4"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-lg mx-auto p-4">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          Order not found
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Order #{orderId}</h2>
            <OrderStatusBadge status={order.status} />
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Items</h3>
            <div className="space-y-2">
              {Array.isArray(order.order_items) && order.order_items.length > 0 ? (
                order.order_items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b">
                    <div>
                      <p className="font-medium">{item.menu_item_name || 'Unknown Item'}</p>
                      <p className="text-sm text-gray-600">Quantity: {item.quantity || 0}</p>
                    </div>
                    <p className="font-medium">
                      ${((parseFloat(item.menu_item_price) || 0) * (item.quantity || 0)).toFixed(2)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No items in this order</p>
              )}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Order Details</h3>
            <p className="text-gray-600">Table #{order.table_number || 'N/A'}</p>
            <p className="text-gray-600">
              Total: ${parseFloat(order.total_amount || 0).toFixed(2)}
            </p>
          </div>

          {order.status === 'pending' && (
            <button
              onClick={handleCancel}
              className="w-full bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 transition-colors"
            >
              Cancel Order
            </button>
          )}

          {renderTableSelection()}

          {order.status === 'delivered' && !order.review && (
            <form onSubmit={handleReviewSubmit} className="mt-6">
              <h3 className="text-lg font-semibold mb-4">Leave a Review</h3>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Rating</label>
                <select
                  value={review.rating}
                  onChange={(e) => setReview({ ...review, rating: parseInt(e.target.value) })}
                  className="w-full border rounded p-2"
                >
                  {[5, 4, 3, 2, 1].map((num) => (
                    <option key={num} value={num}>{num} Stars</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Comment</label>
                <textarea
                  value={review.comment}
                  onChange={(e) => setReview({ ...review, comment: e.target.value })}
                  className="w-full border rounded p-2"
                  rows="4"
                  placeholder="Tell us about your experience..."
                ></textarea>
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
              >
                Submit Review
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderTracking;
