import { useState, useEffect, useCallback } from 'react';
import { extensionBridge, ExtensionStatus, CaptureSessionOptions } from '@/lib/extensionBridge';

export function useExtension() {
  const [status, setStatus] = useState<ExtensionStatus>({ installed: false });
  const [isChecking, setIsChecking] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);

  const checkExtension = useCallback(async () => {
    setIsChecking(true);
    try {
      const newStatus = await extensionBridge.checkStatus();
      setStatus(newStatus);
      setIsCapturing(newStatus.isCapturing || false);
    } catch {
      setStatus({ installed: false });
    } finally {
      setIsChecking(false);
    }
  }, []);

  const setExtensionId = useCallback((id: string) => {
    extensionBridge.setExtensionId(id);
    checkExtension();
  }, [checkExtension]);

  const startCapture = useCallback(async (options: CaptureSessionOptions) => {
    const result = await extensionBridge.startCaptureSession(options);
    if (result.success) {
      setIsCapturing(true);
    }
    return result;
  }, []);

  const stopCapture = useCallback(async () => {
    const result = await extensionBridge.stopCaptureSession();
    setIsCapturing(false);
    return result;
  }, []);

  const getCaptureStatus = useCallback(async () => {
    return extensionBridge.getCaptureStatus();
  }, []);

  useEffect(() => {
    checkExtension();
    
    const interval = setInterval(() => {
      if (isCapturing) {
        getCaptureStatus().then(result => {
          setIsCapturing(result.isCapturing);
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [checkExtension, getCaptureStatus, isCapturing]);

  return {
    status,
    isChecking,
    isCapturing,
    checkExtension,
    setExtensionId,
    startCapture,
    stopCapture,
    getCaptureStatus,
    extensionId: extensionBridge.getExtensionId()
  };
}
