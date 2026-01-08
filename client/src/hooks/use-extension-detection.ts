import { useState, useEffect } from "react";

export function useExtensionDetection() {
  const [isExtensionInstalled, setIsExtensionInstalled] = useState<boolean | null>(null);
  const [extensionVersion, setExtensionVersion] = useState<string | null>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
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

    window.postMessage({ type: 'FLOWCAPTURE_CHECK_EXTENSION' }, '*');

    timeoutId = setTimeout(() => {
      if (!responded) {
        setIsExtensionInstalled(false);
      }
    }, 500);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeoutId);
    };
  }, []);

  return { isExtensionInstalled, extensionVersion, isLoading: isExtensionInstalled === null };
}
