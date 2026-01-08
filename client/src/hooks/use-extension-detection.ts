import { useState, useEffect, useCallback } from "react";

export function useExtensionDetection() {
  const [isExtensionInstalled, setIsExtensionInstalled] = useState<boolean | null>(null);
  const [extensionVersion, setExtensionVersion] = useState<string | null>(null);

  const checkDomMarker = useCallback(() => {
    const marker = document.documentElement.dataset.flowcaptureExtension;
    if (marker) {
      setIsExtensionInstalled(true);
      setExtensionVersion(marker === 'true' ? null : marker);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    // First check DOM marker (most reliable, set synchronously by extension)
    if (checkDomMarker()) {
      return;
    }

    let timeoutId: NodeJS.Timeout;
    let retryCount = 0;
    const maxRetries = 3;
    let responded = false;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'FLOWCAPTURE_EXTENSION_PRESENT') {
        responded = true;
        setIsExtensionInstalled(true);
        setExtensionVersion(event.data.version || null);
        clearTimeout(timeoutId);
      }
    };

    window.addEventListener('message', handleMessage);

    const tryDetect = () => {
      // Check DOM marker again (extension might have loaded)
      if (checkDomMarker()) {
        window.removeEventListener('message', handleMessage);
        return;
      }

      // Send message-based detection
      window.postMessage({ type: 'FLOWCAPTURE_CHECK_EXTENSION' }, '*');

      timeoutId = setTimeout(() => {
        if (!responded) {
          retryCount++;
          if (retryCount < maxRetries) {
            tryDetect();
          } else {
            // Final check of DOM marker before declaring not installed
            if (!checkDomMarker()) {
              setIsExtensionInstalled(false);
            }
          }
        }
      }, 300);
    };

    // Small delay to allow extension content script to initialize
    setTimeout(tryDetect, 100);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeoutId);
    };
  }, [checkDomMarker]);

  return { isExtensionInstalled, extensionVersion, isLoading: isExtensionInstalled === null };
}
