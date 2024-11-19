import React, { useState, useEffect } from "react";
import { AlertCircle, Wifi } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TagDetail = () => {
  const [nfcData, setNfcData] = useState(null);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  // Check NFC availability on component mount
  useEffect(() => {
    if (!("NDEFReader" in window)) {
      setError("Web NFC is not supported on this device.");
    }
  }, []);

  const parseNdefRecord = (record) => {
    try {
      if (record.recordType === "text") {
        const textDecoder = new TextDecoder(record.encoding || "utf-8");
        return textDecoder.decode(record.data);
      } else if (record.recordType === "url") {
        const textDecoder = new TextDecoder();
        return textDecoder.decode(record.data);
      } else {
        // For other record types, return the raw data as hex
        return Array.from(new Uint8Array(record.data))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      }
    } catch (err) {
      console.error("Error parsing NDEF record:", err);
      return "Error parsing record";
    }
  };

  const readNfcTag = async () => {
    setError(null);
    setIsScanning(true);
    console.log("Starting NFC scan...");

    try {
      const ndef = new window.NDEFReader();
      console.log("Created NDEFReader");

      await ndef.scan();
      console.log("Scan started");

      ndef.addEventListener("reading", ({ message, serialNumber }) => {
        console.log("NFC tag detected:", { serialNumber, message });

        try {
          const records = [];
          for (const record of message.records) {
            console.log("Processing record:", record);
            const parsedData = parseNdefRecord(record);
            records.push({
              recordType: record.recordType,
              data: parsedData,
              encoding: record.encoding || "utf-8",
              mediaType: record.mediaType || "text/plain",
            });
          }

          const tagData = {
            id: serialNumber,
            timestamp: new Date().toISOString(),
            records: records,
            rawRecordCount: message.records.length,
          };

          console.log("Processed tag data:", tagData);
          setNfcData(tagData);
          setIsScanning(false);
        } catch (parseErr) {
          console.error("Error processing tag data:", parseErr);
          setError("Error processing tag data: " + parseErr.message);
          setIsScanning(false);
        }
      });

      ndef.addEventListener("readingerror", (error) => {
        console.error("NFC reading error:", error);
        setError("Error reading NFC tag: " + error.message);
        setIsScanning(false);
      });
    } catch (err) {
      console.error("NFC setup error:", err);
      setError("Failed to start NFC: " + err.message);
      setIsScanning(false);
    }
  };

  const formatRecordData = (record) => {
    if (record.recordType === "url") {
      return `URL: ${record.data}`;
    } else if (record.recordType === "text") {
      return `Text: ${record.data}`;
    } else {
      return `${record.recordType}: ${record.data}`;
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">TAG Detail</h1>

      <Button
        onClick={readNfcTag}
        disabled={isScanning || !!error}
        className="mb-6 w-full sm:w-auto"
      >
        <Wifi className="mr-2 h-4 w-4" />
        {isScanning ? "Scanning..." : "Read NFC Tag"}
      </Button>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {nfcData && (
        <Card>
          <CardHeader>
            <CardTitle>Tag Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">UID</h3>
              <p className="font-mono bg-slate-50 p-2 rounded">{nfcData.id}</p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">
                Records ({nfcData.rawRecordCount})
              </h3>
              <div className="space-y-2">
                {nfcData.records.map((record, index) => (
                  <div
                    key={index}
                    className="p-3 bg-slate-50 rounded border border-slate-200"
                  >
                    <p className="text-sm text-slate-600 mb-1">
                      Type: {record.recordType}
                    </p>
                    <p className="font-mono break-all">
                      {formatRecordData(record)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Encoding: {record.encoding}, Media Type:{" "}
                      {record.mediaType}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Raw Data</h3>
              <pre className="bg-slate-50 p-4 rounded overflow-x-auto text-sm">
                {JSON.stringify(nfcData, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TagDetail;
