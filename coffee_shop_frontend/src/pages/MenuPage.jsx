import React, { useState, useRef } from "react";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";
import { MenuList } from "../components/MenuList";
import { Cart } from "../components/Cart";
import { createOrder } from "../api/customAcios";
import { QrReader } from "react-qr-reader";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

const MenuPage = () => {
  const [cartItems, setCartItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tableNumber, setTableNumber] = useState(null);
  const [qrScanned, setQrScanned] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [cameraError, setCameraError] = useState(null);
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

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      cameraStreamRef.current = null;
    }
  };

  const startScanner = async () => {
    try {
      // Configuration plus détaillée pour la caméra
      const constraints = {
        video: {
          facingMode: { exact: "environment" }, // Force la caméra arrière
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraStreamRef.current = stream;
      setCameraError(null);
      setShowScanner(true);
    } catch (firstError) {
      console.log("First attempt failed, trying fallback:", firstError);

      try {
        // Fallback avec des contraintes plus simples
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }, // Sans 'exact' pour plus de flexibilité
        });
        cameraStreamRef.current = fallbackStream;
        setCameraError(null);
        setShowScanner(true);
      } catch (error) {
        console.error("Camera access error:", error);
        setCameraError(
          error.name === "NotAllowedError"
            ? "Accès à la caméra refusé. Veuillez autoriser l'accès à la caméra dans les paramètres de votre navigateur."
            : error.name === "NotFoundError"
            ? "Aucune caméra trouvée sur votre appareil."
            : "Impossible d'accéder à la caméra. Veuillez vérifier que votre appareil dispose d'une caméra fonctionnelle."
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
      console.error("QR Scan Error:", error);
      if (error?.name === "NotAllowedError") {
        setCameraError(
          "Accès à la caméra refusé. Veuillez autoriser l'accès à la caméra dans les paramètres de votre navigateur."
        );
      } else if (error?.name === "NotFoundError") {
        setCameraError("Aucune caméra trouvée sur votre appareil.");
      } else {
        setCameraError(
          "Échec de la numérisation du QR code. Veuillez réessayer."
        );
      }
    }
  };

  const handleCheckout = async () => {
    if (!qrScanned) {
      toast.error("Veuillez d'abord scanner le QR code de votre table !");
      return;
    }
    if (cartItems.length === 0) {
      toast.error("Votre panier est vide !");
      return;
    }

    try {
      setIsLoading(true);
      const orderData = {
        table: tableNumber,
        status: "pending",
        items: cartItems.map(({ item, quantity }) => ({
          menu_item: item.id,
          quantity,
          notes: "",
        })),
      };

      const response = await createOrder(orderData);
      setCartItems([]);
      toast.success("Commande passée avec succès !");
      console.log("Order created:", response);
    } catch (error) {
      console.error("Error creating order:", error);
      toast.error(
        error.response?.data?.error ||
          "Échec de la commande. Veuillez réessayer."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Nettoyage du flux de la caméra lors du démontage du composant
  React.useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <>
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow-md">
          <div className="container mx-auto px-4 py-6">
            <h1 className="text-2xl font-bold">Coffee Shop</h1>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          {!qrScanned && (
            <div className="mb-8">
              {!showScanner ? (
                <div className="flex flex-col items-center gap-4">
                  <Button
                    onClick={startScanner}
                    className="flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    Scanner le QR code de la table
                  </Button>
                  {cameraError && (
                    <Alert variant="destructive" className="mt-4">
                      <AlertDescription>{cameraError}</AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <div className="relative w-full max-w-md mx-auto">
                  <QrReader
                    constraints={{
                      facingMode: "environment",
                    }}
                    onResult={(result, error) => {
                      if (result) {
                        handleQrScan(result);
                      }
                      if (error) {
                        handleQrError(error);
                      }
                    }}
                    className="w-full aspect-square rounded-lg overflow-hidden"
                    videoStyle={{ width: "100%", height: "100%" }}
                    containerStyle={{ width: "100%", height: "100%" }}
                    ViewFinder={() => (
                      <div className="border-2 border-white absolute top-1/4 left-1/4 w-1/2 h-1/2" />
                    )}
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
                tableNumber={tableNumber}
              />
            </div>
          </div>
        </main>
      </div>
      <Toaster position="bottom-right" />
    </>
  );
};

export default MenuPage;
