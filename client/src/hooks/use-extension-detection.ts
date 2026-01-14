import { useState, useEffect, useCallback } from "react";
import { extensionBridge } from "@/lib/extensionBridge";

type PermissionStatus = 'unknown' | 'granted' | 'denied' | 'pending';

const EXTENSION_ID_KEY = 'flowcapture_extension_id';

export function useExtensionDetection() {
  const [isExtensionInstalled, setIsExtensionInstalled] = useState<boolean | null>(null);
  const [extensionVersion, setExtensionVersion] = useState<string | null>(null);
  const [extensionId, setExtensionId] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('unknown');
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  const checkDomMarker = useCallback(() => {
    const marker = document.documentElement.dataset.flowcaptureExtension;
    if (marker) {
      setIsExtensionInstalled(true);
      setExtensionVersion(marker === 'true' ? null : marker);
      return true;
    }
    return false;
  }, []);

  const checkPermissions = useCallback(() => {
    if (isExtensionInstalled !== true) return;
    
    const handlePermissionStatus = (event: MessageEvent) => {
      if (event.data?.type === 'FLOWCAPTURE_PERMISSIONS_STATUS') {
        setPermissionStatus(event.data.hasPermission ? 'granted' : 'denied');
        window.removeEventListener('message', handlePermissionStatus);
      }
    };
    
    window.addEventListener('message', handlePermissionStatus);
    window.postMessage({ type: 'FLOWCAPTURE_CHECK_PERMISSIONS' }, '*');
    
    setTimeout(() => {
      window.removeEventListener('message', handlePermissionStatus);
    }, 3000);
  }, [isExtensionInstalled]);

  const requestPermissions = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (isExtensionInstalled !== true) {
        resolve(false);
        return;
      }

      setIsRequestingPermission(true);
      setPermissionStatus('pending');
      
      const handlePermissionResult = (event: MessageEvent) => {
        if (event.data?.type === 'FLOWCAPTURE_PERMISSIONS_RESULT') {
          const granted = event.data.granted;
          setPermissionStatus(granted ? 'granted' : 'denied');
          setIsRequestingPermission(false);
          window.removeEventListener('message', handlePermissionResult);
          resolve(granted);
        }
      };
      
      window.addEventListener('message', handlePermissionResult);
      window.postMessage({ type: 'FLOWCAPTURE_REQUEST_PERMISSIONS' }, '*');
      
      setTimeout(() => {
        window.removeEventListener('message', handlePermissionResult);
        setIsRequestingPermission(false);
        resolve(false);
      }, 30000);
    });
  }, [isExtensionInstalled]);

  useEffect(() => {
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
        if (event.data.extensionId) {
          setExtensionId(event.data.extensionId);
          localStorage.setItem(EXTENSION_ID_KEY, event.data.extensionId);
          extensionBridge.setExtensionId(event.data.extensionId);
        }
        clearTimeout(timeoutId);
      }
    };

    window.addEventListener('message', handleMessage);

    const tryDetect = () => {
      if (checkDomMarker()) {
        window.removeEventListener('message', handleMessage);
        return;
      }

      window.postMessage({ type: 'FLOWCAPTURE_CHECK_EXTENSION' }, '*');

      timeoutId = setTimeout(() => {
        if (!responded) {
          retryCount++;
          if (retryCount < maxRetries) {
            tryDetect();
          } else {
            if (!checkDomMarker()) {
              setIsExtensionInstalled(false);
            }
          }
        }
      }, 300);
    };

    setTimeout(tryDetect, 100);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeoutId);
    };
  }, [checkDomMarker]);

  useEffect(() => {
    if (isExtensionInstalled === true && permissionStatus === 'unknown') {
      checkPermissions();
    }
  }, [isExtensionInstalled, permissionStatus, checkPermissions]);

  return { 
    isExtensionInstalled, 
    extensionVersion,
    extensionId,
    isLoading: isExtensionInstalled === null,
    permissionStatus,
    isRequestingPermission,
    requestPermissions,
    checkPermissions
  };
}
