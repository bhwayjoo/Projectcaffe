import React, { useState, useRef } from "react";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";
import { MenuList } from "../components/MenuList";
import { Cart } from "../components/Cart";
import { createOrder } from "../api/customAcios";
import { QrReader } from "react-qr-reader";
import { Camera, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import SvgIcon1 from "../logo/SvgIcon1";
//ss
const NFC_TABLE_MAPPING = {
  "43:66:75:f3": "1",
  "e3:18:4f:f3": "2",
  "d6:7f:94:0e": "3",
  "30:e7:21:01": "4",
};

const MenuPage = () => {
  const [cartItems, setCartItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tableNumber, setTableNumber] = useState(null);
  const [qrScanned, setQrScanned] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isNfcScanning, setIsNfcScanning] = useState(false);
  const [nfcError, setNfcError] = useState(null);
  const cameraStreamRef = useRef(null);
  const hasShownToastRef = useRef(false);

  const handleAddToCart = (item) => {
    setCartItems((prev) => {
      const existingItem = prev.find((i) => i.item.id === item.id);
      if (existingItem) {
        return prev.map((i) =>
          i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (item, quantity) => {
    if (quantity <= 0) {
      handleRemoveItem(item);
      return;
    }
    setCartItems((prev) =>
      prev.map((i) => (i.item.id === item.id ? { ...i, quantity } : i))
    );
  };

  const handleRemoveItem = (item) => {
    setCartItems((prev) => prev.filter((i) => i.item.id !== item.id));
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
          setTableNumber(mappedTable);
          setQrScanned(true);
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
      setTableNumber(result.text);
      setQrScanned(true);
      setShowScanner(false);
      stopCamera();
      if (!hasShownToastRef.current) {
        toast.success(`Table numéro ${result.text} scannée !`);
        hasShownToastRef.current = true;
      }
    }
  };

  const handleQrError = (error) => {
    if (error && error?.message !== "No QR code found") {
      setCameraError("Erreur lors de la numérisation QR.");
    }
  };

  const handleCheckout = async () => {
    if (!tableNumber) {
      toast.error("Please scan a table QR code first!");
      return null;
    }

    if (cartItems.length === 0) {
      toast.error("Your cart is empty!");
      return null;
    }

    setIsLoading(true);
    try {
      const orderData = {
        table: tableNumber,
        items: cartItems.map((cartItem) => ({
          menu_item: cartItem.item.id,
          quantity: cartItem.quantity,
        })),
      };

      const response = await createOrder(orderData);
      console.log('Order response:', response); // Debug log
      
      if (response?.data?.id) {
        setCartItems([]);
        toast.success("Order placed successfully!");
        return response.data.id;
      } else {
        console.error('Invalid response structure:', response); // Debug log
        throw new Error("No order ID received from server");
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to place order. Please try again.";
      toast.error(errorMessage);
      console.error("Checkout error:", error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-md py-4">
          <div className="container mx-auto flex items-center justify-center">
            <SvgIcon1 width="50" height="50" className="mr-4" />
            <h1 className="text-2xl font-bold">Menu</h1>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          {!qrScanned && (
            <div className="mb-8">
              {!showScanner ? (
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
                  {cameraError && (
                    <Alert variant="destructive" className="mt-4">
                      <AlertDescription>{cameraError}</AlertDescription>
                    </Alert>
                  )}
                  {nfcError && (
                    <Alert variant="destructive" className="mt-4">
                      <AlertDescription>{nfcError}</AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
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
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <MenuList onAddToCart={handleAddToCart} />
            </div>
            <div className="lg:col-span-1">
              <Cart
                items={cartItems}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
                onCheckout={handleCheckout}
                isLoading={isLoading}
              />
            </div>
          </div>
        </main>
      </div>
      <Toaster />
    </>
  );
};

export default MenuPage;
