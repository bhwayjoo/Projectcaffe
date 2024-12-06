export class NfcReader {
    static async read() {
        try {
            if ('NDEFReader' in window) {
                const ndef = new window.NDEFReader();
                await ndef.scan();
                
                return new Promise((resolve, reject) => {
                    ndef.onreading = event => {
                        const decoder = new TextDecoder();
                        for (const record of event.message.records) {
                            if (record.recordType === "text") {
                                try {
                                    const tableData = JSON.parse(decoder.decode(record.data));
                                    if (tableData.table_id) {
                                        resolve(tableData.table_id);
                                        return;
                                    }
                                } catch (e) {
                                    reject(new Error('Invalid NFC data format'));
                                }
                            }
                        }
                        reject(new Error('No valid table data found'));
                    };
                    
                    ndef.onerror = () => {
                        reject(new Error('Error reading NFC tag'));
                    };
                });
            } else {
                throw new Error('NFC not supported on this device');
            }
        } catch (error) {
            throw error;
        }
    }
}
