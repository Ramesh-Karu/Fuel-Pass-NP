export const isNfcSupported = () => {
  return 'NDEFReader' in window;
};

export const writeNfcTag = async (data: string): Promise<void> => {
  if (!isNfcSupported()) {
    throw new Error('NFC is not supported on this device or browser.');
  }

  try {
    const ndef = new (window as any).NDEFWriter();
    await ndef.write(data);
  } catch (error) {
    console.error('NFC write error:', error);
    throw error;
  }
};

export const readNfcTag = async (): Promise<string | null> => {
  console.log('readNfcTag called');
  if (!isNfcSupported()) {
    console.log('NFC not supported');
    throw new Error('NFC is not supported on this device or browser.');
  }

  try {
    const ndef = new (window as any).NDEFReader();
    console.log('NDEFReader created');
    await ndef.scan();
    console.log('Scan started');
    
    return new Promise((resolve, reject) => {
      ndef.onreading = (event: any) => {
        console.log('NFC tag read');
        const decoder = new TextDecoder();
        for (const record of event.message.records) {
          if (record.recordType === 'text') {
            const data = decoder.decode(record.data);
            console.log('Data read:', data);
            resolve(data);
            return;
          }
        }
        reject(new Error('No text record found on NFC tag.'));
      };
      
      ndef.onreadingerror = (event: any) => {
        console.log('NFC read error:', event);
        reject(new Error('Error reading NFC tag.'));
      };
    });
  } catch (error) {
    console.error('NFC read error:', error);
    throw error;
  }
};
