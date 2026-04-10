import { useEffect, useState, useRef } from "react";
import { useRoute } from "wouter";
import { useGuide, useUpdateGuide } from "@/hooks/use-guides";
import { useSteps, useCreateStep, useUpdateStep, useReorderSteps, useDeleteStep } from "@/hooks/use-steps";
import { api } from "@shared/routes";
import { useCollections, useMoveFlowToCollection } from "@/hooks/use-collections";
import { useWorkspace } from "@/hooks/use-workspaces";
import { useGenerateDescription } from "@/hooks/use-ai";
import { useExtensionDetection } from "@/hooks/use-extension-detection";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { InstallExtensionDialog } from "@/components/InstallExtensionDialog";
import { PermissionDeniedDialog } from "@/components/PermissionDeniedDialog";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { ScreenshotBeautifier } from "@/components/ScreenshotBeautifier";
import { ElementZoomAnimation } from "@/components/ElementHighlightOverlay";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { 
  Save, ArrowLeft, Wand2, MoreHorizontal, Trash2,
  GripVertical, Image as ImageIcon, CheckCircle, ExternalLink, Sparkles, Upload,
  Share2, Copy, Lock, Eye, EyeOff, Download, Code, FileText, Languages, Volume2,
  Video, Square, Loader2, Settings, LayoutGrid, Plus, BookOpen, FolderOpen, Pause, Play, X,
  ClipboardList, GraduationCap, Library, HelpCircle, History, RotateCcw
} from "lucide-react";
import { TranslationDialog } from "@/components/TranslationDialog";
import { VoiceoverPanel } from "@/components/VoiceoverPanel";
import { RedactionPanel } from "@/components/RedactionPanel";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Guide, KbCategory } from "@shared/schema";
import { normalizeScreenshot } from "@/lib/normalizeScreenshot";

export default function GuideEditor() {
  const [, params] = useRoute("/guides/:id/edit");
  const guideId = parseInt(params?.id || "0");
  const { data: guide, isLoading: guideLoading } = useGuide(guideId);
  const { data: steps, isLoading: stepsLoading } = useSteps(guideId);
  const { data: collections } = useCollections(guide?.workspaceId);
  const { data: workspace } = useWorkspace(guide?.workspaceId || 0);
  const { mutate: moveFlowToCollection } = useMoveFlowToCollection();
  
  const { mutate: updateGuide } = useUpdateGuide();
  const { mutate: createStep, isPending: isCreatingStep } = useCreateStep();
  const { mutate: updateStep } = useUpdateStep();
  const { mutate: deleteStep } = useDeleteStep();
  const { mutate: reorderSteps } = useReorderSteps();
  const { mutate: generateDesc, isPending: isGenerating } = useGenerateDescription();

  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);
  const [beautifierOpen, setBeautifierOpen] = useState(false);
  const [beautifierImageUrl, setBeautifierImageUrl] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharePassword, setSharePassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false);
  const [translationDialogOpen, setTranslationDialogOpen] = useState(false);
  const [voiceoverDialogOpen, setVoiceoverDialogOpen] = useState(false);
  const [redactionDialogOpen, setRedactionDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [kbConvertDialogOpen, setKbConvertDialogOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const [captureToken, setCaptureToken] = useState<string | null>(null);
  const [captureSessionNonce, setCaptureSessionNonce] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [showExtensionDialog, setShowExtensionDialog] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { isExtensionInstalled, permissionStatus, requestPermissions, extensionId } = useExtensionDetection();

  // Capture session status
  const { data: captureStatus, refetch: refetchCaptureStatus } = useQuery({
    queryKey: ['/api/guides', guideId, 'capture', 'status'],
    queryFn: async () => {
      const res = await fetch(`/api/guides/${guideId}/capture/status`, { credentials: 'include' });
      if (!res.ok) return { active: false };
      return res.json();
    },
    enabled: guideId > 0,
    refetchInterval: captureToken ? 5000 : false, // Poll while capturing
  });

  // Function to send session to extension via postMessage (for recovery/sync)
  const sendSessionToExtension = (session: { token: string; guideId: number; expiresAt: string; apiBaseUrl?: string; workspaceId?: number; extensionToken?: string }) => {
    // Use window.origin for security - only same-origin pages can receive this message
    // Include complete payload so recovery scenarios can fully configure state
    window.postMessage({ 
      type: 'FLOWCAPTURE_SET_SESSION', 
      session: {
        ...session,
        apiBaseUrl: session.apiBaseUrl || window.location.origin
      }
    }, window.origin);
  };

  // Function to start capture session with tab selector - opens immediately
  const startCaptureSessionWithTabSelector = (session: { token: string; guideId: number; expiresAt: string }) => {
    // This triggers the tab selector to open, allowing user to pick which tab to capture
    window.postMessage({ 
      type: 'FLOWCAPTURE_START_CAPTURE_SESSION', 
      session: {
        ...session,
        workspaceId: guide?.workspaceId,
        apiBaseUrl: window.location.origin
      }
    }, window.origin);
  };

  // Function to clear session from extension
  const clearSessionFromExtension = () => {
    window.postMessage({ type: 'FLOWCAPTURE_CLEAR_SESSION' }, window.origin);
  };

  // Function to pause capture (waits for confirmation)
  const pauseCapture = () => {
    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(false);
      }, 3000);
      
      const handler = (event: MessageEvent) => {
        if (event.data?.type === 'FLOWCAPTURE_PAUSE_RESULT') {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          if (event.data.success) {
            setIsPaused(true);
            resolve(true);
          } else {
            resolve(false);
          }
        }
      };
      
      window.addEventListener('message', handler);
      window.postMessage({ type: 'FLOWCAPTURE_PAUSE_CAPTURE' }, window.origin);
    });
  };

  // Function to resume capture (waits for confirmation)
  const resumeCapture = () => {
    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(false);
      }, 3000);
      
      const handler = (event: MessageEvent) => {
        if (event.data?.type === 'FLOWCAPTURE_RESUME_RESULT') {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          if (event.data.success) {
            setIsPaused(false);
            resolve(true);
          } else {
            resolve(false);
          }
        }
      };
      
      window.addEventListener('message', handler);
      window.postMessage({ type: 'FLOWCAPTURE_RESUME_CAPTURE' }, window.origin);
    });
  };

  const startCaptureMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/guides/${guideId}/capture/start`, {});
      return res.json();
    },
    onSuccess: (data) => {
      setCaptureToken(data.token);
      setIsPaused(false); // Reset pause state
      refetchCaptureStatus();
      
      // Build session with complete payload for reliable recovery
      const session = {
        token: data.token,
        guideId: guideId,
        expiresAt: data.expiresAt,
        apiBaseUrl: window.location.origin,
        workspaceId: guide?.workspaceId,
        extensionToken: data.extensionToken, // Bearer token so extension can sync without cookies
      };

      // CRITICAL: First send SET_SESSION to establish session persistence in background FSM
      // This ensures the canonical session saving path is used for reconnects
      sendSessionToExtension(session);

      // Then open tab selector so user can pick which tab to capture
      startCaptureSessionWithTabSelector(session);

      // Also store in localStorage as fallback for session recovery
      localStorage.setItem('flowcapture_session', JSON.stringify(session));
      
      toast({ 
        title: "Select a Tab", 
        description: "Choose which browser tab you want to capture." 
      });
    },
    onError: () => {
      toast({ title: "Failed to start capture", variant: "destructive" });
    },
  });

  const stopCaptureMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/guides/${guideId}/capture/stop`, {});
      return res.json();
    },
    onSuccess: (data) => {
      setCaptureToken(null);
      setIsPaused(false); // Reset pause state
      
      // Clear session from extension
      clearSessionFromExtension();
      localStorage.removeItem('flowcapture_session');
      
      refetchCaptureStatus();
      queryClient.invalidateQueries({ queryKey: [api.steps.list.path, guideId] });
      toast({ 
        title: "Capture Complete", 
        description: `Captured ${data.stepsCreated} steps` 
      });
    },
    onError: () => {
      toast({ title: "Failed to stop capture", variant: "destructive" });
    },
  });

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const cancelCaptureMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/guides/${guideId}/capture/cancel`, {});
      return res.json();
    },
    onSuccess: (data) => {
      setCaptureToken(null);
      setIsPaused(false);
      setShowCancelConfirm(false);
      
      // Clear session from extension
      clearSessionFromExtension();
      localStorage.removeItem('flowcapture_session');
      
      refetchCaptureStatus();
      queryClient.invalidateQueries({ queryKey: [api.steps.list.path, guideId] });
      toast({ 
        title: "Capture Cancelled", 
        description: data.stepsDeleted > 0 
          ? `Deleted ${data.stepsDeleted} captured steps` 
          : "No steps were captured"
      });
    },
    onError: () => {
      toast({ title: "Failed to cancel capture", variant: "destructive" });
    },
  });

  const isCapturing = captureStatus?.active || captureToken !== null;

  // Reconcile session state when server says inactive but we have a local token
  useEffect(() => {
    if (captureStatus && !captureStatus.active && captureToken) {
      // Session expired on server, clean up local state
      setCaptureToken(null);
      clearSessionFromExtension();
      localStorage.removeItem('flowcapture_session');
    }
  }, [captureStatus, captureToken]);

  // Rehydrate session from localStorage on mount and resend to extension
  useEffect(() => {
    const stored = localStorage.getItem('flowcapture_session');
    if (stored) {
      try {
        const session = JSON.parse(stored);
        if (session.guideId === guideId && new Date(session.expiresAt) > new Date()) {
          setCaptureToken(session.token);
          // Resend to extension in case it reloaded
          sendSessionToExtension(session);
        } else {
          // Expired or wrong guide, clean up
          localStorage.removeItem('flowcapture_session');
        }
      } catch (e) {
        localStorage.removeItem('flowcapture_session');
      }
    }
  }, [guideId]);

  // When server shows active session but we don't have local token, try to resync
  useEffect(() => {
    if (captureStatus?.active && !captureToken && captureStatus.token) {
      const session = {
        token: captureStatus.token,
        guideId: guideId,
        expiresAt: captureStatus.expiresAt,
      };
      setCaptureToken(captureStatus.token);
      sendSessionToExtension(session);
      localStorage.setItem('flowcapture_session', JSON.stringify(session));
    }
  }, [captureStatus, captureToken, guideId]);

  // Request current capture state from extension on mount
  useEffect(() => {
    window.postMessage({ type: 'FLOWCAPTURE_GET_STATE' }, window.origin);
  }, []);

  // Listen for extension messages
  useEffect(() => {
    const handleExtensionMessage = (event: MessageEvent) => {
      // Security: Only accept messages from same origin
      if (event.origin !== window.origin) return;
      
      if (event.data?.type === 'FLOWCAPTURE_SESSION_ENDED') {
        // Capture session ended (from extension stop button or web app stop)
        console.log('Capture session ended:', event.data);
        setCaptureToken(null);
        setIsPaused(false);
        localStorage.removeItem('flowcapture_session');
        refetchCaptureStatus();
        queryClient.invalidateQueries({ queryKey: [api.steps.list.path, guideId] });
        if (event.data.success) {
          toast({ 
            title: "Capture Complete", 
            description: event.data.stepCount 
              ? `Captured ${event.data.stepCount} steps` 
              : "Your captured steps have been saved.",
            variant: "default" 
          });
        }
      } else if (event.data?.type === 'FLOWCAPTURE_SESSION_SET') {
        if (event.data.success) {
          console.log('Extension accepted capture session');
        } else if (event.data.error === 'permissions_required') {
          console.log('Extension needs permissions to capture');
          setShowPermissionDialog(true);
        } else {
          console.error('Extension rejected capture session:', event.data.error);
          toast({ 
            title: "Extension Error", 
            description: "Failed to start capture. Please reinstall the extension.",
            variant: "destructive" 
          });
        }
      } else if (event.data?.type === 'FLOWCAPTURE_SESSION_CLEARED') {
        console.log('Extension cleared capture session');
      } else if (event.data?.type === 'FLOWCAPTURE_EXTENSION_PRESENT') {
        console.log('Extension detected, version:', event.data.version);
      } else if (event.data?.type === 'FLOWCAPTURE_SESSION_EXPIRED') {
        // Session expired (401 from backend)
        console.log('Capture session expired');
        setCaptureToken(null);
        localStorage.removeItem('flowcapture_session');
        refetchCaptureStatus();
        queryClient.invalidateQueries({ queryKey: [api.steps.list.path, guideId] });
        toast({ 
          title: "Capture Complete", 
          description: "The capture session ended. Your captured steps have been saved.",
          variant: "default" 
        });
      } else if (event.data?.type === 'FLOWCAPTURE_EXTENSION_UPDATED') {
        // Extension was updated - resync session if we have one
        console.log('Extension updated to version:', event.data.version);
        const stored = localStorage.getItem('flowcapture_session');
        if (stored) {
          try {
            const session = JSON.parse(stored);
            if (session.guideId === guideId && new Date(session.expiresAt) > new Date()) {
              console.log('Resyncing capture session after extension update');
              sendSessionToExtension(session);
              toast({ 
                title: "Extension Updated", 
                description: "FlowCapture extension was updated. Capture session restored.",
                variant: "default" 
              });
            }
          } catch (e) {
            console.error('Failed to resync session after update:', e);
          }
        }
      } else if (event.data?.type === 'FLOWCAPTURE_STATE_UPDATE') {
        // Sync pause state from extension
        console.log('Extension state update:', event.data);
        if (typeof event.data.isPaused === 'boolean') {
          setIsPaused(event.data.isPaused);
        }
      } else if (event.data?.type === 'FLOWCAPTURE_CAPTURE_STARTED') {
        // Store the session nonce for secure completion verification
        if (event.data.guideId === guideId && event.data.sessionNonce) {
          console.log('Capture started, storing session nonce');
          setCaptureSessionNonce(event.data.sessionNonce);
        }
      } else if (event.data?.type === 'FLOWCAPTURE_CAPTURE_COMPLETE') {
        // Validate that this completion is for the current guide (security check)
        if (event.data.guideId !== guideId) {
          console.log('Ignoring completion for different guide:', event.data.guideId, 'vs current:', guideId);
          return;
        }
        // Validate extensionId to prevent spoofing from malicious pages (security check)
        if (extensionId && event.data.extensionId !== extensionId) {
          console.log('Ignoring completion with invalid extensionId:', event.data.extensionId, 'vs expected:', extensionId);
          return;
        }
        // Validate session nonce for cryptographic authenticity (security check)
        if (captureSessionNonce && event.data.sessionNonce !== captureSessionNonce) {
          console.log('Ignoring completion with invalid session nonce (possible spoof attempt)');
          return;
        }
        // Capture completed - refresh steps and trigger AI description generation
        console.log('Capture complete from extension:', event.data);
        setCaptureToken(null);
        setCaptureSessionNonce(null);
        setIsPaused(false);
        localStorage.removeItem('flowcapture_session');
        refetchCaptureStatus();
        queryClient.invalidateQueries({ queryKey: [api.steps.list.path, guideId] });
        toast({
          title: "Capture Complete",
          description: event.data.stepCount
            ? `Captured ${event.data.stepCount} steps. Generating AI descriptions…`
            : "Your captured steps have been saved. Generating AI descriptions…",
          variant: "default",
        });
        // Auto-generate AI descriptions for all steps that lack one
        fetch(`/api/guides/${guideId}/generate-all-descriptions`, {
          method: 'POST',
          credentials: 'include',
        })
          .then((r) => r.json())
          .then((result) => {
            if (result.updated > 0) {
              queryClient.invalidateQueries({ queryKey: [api.steps.list.path, guideId] });
            }
          })
          .catch((err) => console.warn('Batch description generation failed:', err));
      }
    };

    window.addEventListener('message', handleExtensionMessage);
    return () => window.removeEventListener('message', handleExtensionMessage);
  }, [toast, guideId, refetchCaptureStatus, extensionId, captureSessionNonce]);

  // Share settings query
  const { data: shareSettings, refetch: refetchShare } = useQuery({
    queryKey: ['/api/guides', guideId, 'share'],
    queryFn: async () => {
      const res = await fetch(`/api/guides/${guideId}/share`, { credentials: 'include' });
      if (!res.ok) return { enabled: false, hasPassword: false, shareUrl: null };
      return res.json();
    },
    enabled: guideId > 0,
  });

  // Embed info query (only fetched when embed dialog opens)
  const { data: embedInfo, isError: embedError, error: embedErrorData } = useQuery({
    queryKey: ['/api/guides', guideId, 'embed'],
    queryFn: async () => {
      const res = await fetch(`/api/guides/${guideId}/embed`, { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json();
        throw err;
      }
      return res.json();
    },
    enabled: embedDialogOpen && guideId > 0 && shareSettings?.enabled && !shareSettings?.hasPassword,
    retry: false,
  });

  const updateShareMutation = useMutation({
    mutationFn: async (data: { password?: string | null; enabled?: boolean }) => {
      const res = await apiRequest('POST', `/api/guides/${guideId}/share`, data);
      return res.json();
    },
    onSuccess: () => {
      refetchShare();
      toast({ title: "Share settings updated" });
    },
    onError: () => {
      toast({ title: "Failed to update share settings", variant: "destructive" });
    },
  });

  const handleCopyLink = () => {
    if (shareSettings?.shareUrl) {
      navigator.clipboard.writeText(shareSettings.shareUrl);
      toast({ title: "Link copied to clipboard" });
    }
  };

  const handleSetPassword = () => {
    updateShareMutation.mutate({ password: sharePassword || null, enabled: true });
    setSharePassword("");
  };

  const handleRemovePassword = () => {
    updateShareMutation.mutate({ password: null });
  };

  const handleToggleSharing = (enabled: boolean) => {
    updateShareMutation.mutate({ enabled });
  };

  const handleDownloadHtml = () => {
    window.open(`/api/guides/${guideId}/export/html`, '_blank');
    toast({ title: "Downloading HTML document..." });
  };

  const handleDownloadPdf = async () => {
    if (!guide || !steps) return;
    toast({ title: "Generating PDF..." });
    try {
      const { exportGuideToPdf } = await import("@/lib/pdfExport");
      await exportGuideToPdf(guide, steps);
      toast({ title: "PDF downloaded successfully" });
    } catch (error) {
      console.error("PDF export error:", error);
      toast({ title: "Failed to generate PDF", variant: "destructive" });
    }
  };

  const handleGenerateSOP = async () => {
    if (!guide || !steps) return;
    toast({ title: "Generating SOP document..." });
    try {
      const { generateSOP } = await import("@/lib/sopGenerator");
      await generateSOP(guide as any, steps as any, null);
      toast({ title: "SOP downloaded successfully" });
    } catch (error) {
      console.error("SOP generation error:", error);
      toast({ title: "Failed to generate SOP", variant: "destructive" });
    }
  };

  const handleGenerateTrainingGuide = async () => {
    if (!guide || !steps) return;
    toast({ title: "Generating Training Guide..." });
    try {
      const { generateTrainingGuide } = await import("@/lib/trainingGuideGenerator");
      await generateTrainingGuide(guide as any, steps as any, null);
      toast({ title: "Training Guide downloaded successfully" });
    } catch (error) {
      console.error("Training Guide generation error:", error);
      toast({ title: "Failed to generate Training Guide", variant: "destructive" });
    }
  };

  const handleGenerateKBArticle = async () => {
    if (!guide || !steps) return;
    toast({ title: "Generating Knowledge Base Article..." });
    try {
      const { generateKnowledgeBaseArticle } = await import("@/lib/knowledgeBaseGenerator");
      const workspaceData = workspace ? { name: workspace.name, logoUrl: workspace.logoUrl } : null;
      await generateKnowledgeBaseArticle(guide as any, steps as any, workspaceData);
      toast({ title: "Knowledge Base Article downloaded successfully" });
    } catch (error) {
      console.error("KB Article generation error:", error);
      toast({ title: "Failed to generate Knowledge Base Article", variant: "destructive" });
    }
  };

  const handleGenerateHowTo = async () => {
    if (!guide || !steps) return;
    toast({ title: "Generating How-To Guide..." });
    try {
      const { generateHowToGuide } = await import("@/lib/howToGenerator");
      const workspaceData = workspace ? { name: workspace.name, logoUrl: workspace.logoUrl } : null;
      await generateHowToGuide(guide as any, steps as any, workspaceData);
      toast({ title: "How-To Guide downloaded successfully" });
    } catch (error) {
      console.error("How-To Guide generation error:", error);
      toast({ title: "Failed to generate How-To Guide", variant: "destructive" });
    }
  };

  const handleCopyEmbedCode = () => {
    if (embedInfo?.embedCode) {
      navigator.clipboard.writeText(embedInfo.embedCode);
      toast({ title: "Embed code copied to clipboard" });
    }
  };

  const openBeautifier = (imageUrl: string) => {
    setBeautifierImageUrl(imageUrl);
    setBeautifierOpen(true);
  };

  const handleSaveBeautifiedImage = (canvas: HTMLCanvasElement) => {
    if (!selectedStep) return;
    const dataUrl = canvas.toDataURL("image/png");
    updateStep({ id: selectedStep.id, guideId, imageUrl: dataUrl });
    setBeautifierOpen(false);
  };

  const handleAIAnalysis = (analysis: { title: string; description: string }) => {
    if (!selectedStep) return;
    updateStep({ 
      id: selectedStep.id, 
      guideId, 
      title: analysis.title,
      description: analysis.description 
    });
  };

  const [imageUploading, setImageUploading] = useState(false);
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedStep) return;
    
    setImageUploading(true);
    try {
      // Normalize the screenshot to 16:9 aspect ratio with professional styling
      const normalizedBlob = await normalizeScreenshot(file);
      const normalizedFile = new File([normalizedBlob], file.name.replace(/\.[^.]+$/, '.png'), {
        type: 'image/png',
      });
      
      // Request presigned URL for upload
      const res = await fetch('/api/uploads/request-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: normalizedFile.name,
          size: normalizedFile.size,
          contentType: normalizedFile.type,
        }),
      });
      
      if (!res.ok) {
        throw new Error('Failed to get upload URL');
      }
      
      const { uploadURL, objectPath } = await res.json();
      
      // Upload normalized image to object storage
      const uploadRes = await fetch(uploadURL, {
        method: 'PUT',
        body: normalizedBlob,
        headers: { 'Content-Type': 'image/png' },
      });
      
      if (!uploadRes.ok) {
        throw new Error('Failed to upload file');
      }
      
      // Update step with the object path
      updateStep({ id: selectedStep.id, guideId, imageUrl: objectPath });
      toast({ title: 'Screenshot updated' });
    } catch (error) {
      console.error('Image upload error:', error);
      toast({ title: 'Failed to upload screenshot', variant: 'destructive' });
    } finally {
      setImageUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setThumbnailUploading(true);
    try {
      const res = await fetch('/api/uploads/request-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
      });
      
      if (!res.ok) throw new Error('Failed to get upload URL');
      
      const { uploadURL, objectPath } = await res.json();
      
      const uploadRes = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      
      if (!uploadRes.ok) throw new Error('Failed to upload file');
      
      updateGuide({ id: guideId, coverImageUrl: objectPath });
      toast({ title: 'Thumbnail updated' });
    } catch (error) {
      console.error('Thumbnail upload error:', error);
      toast({ title: 'Failed to upload thumbnail', variant: 'destructive' });
    } finally {
      setThumbnailUploading(false);
      if (thumbnailInputRef.current) thumbnailInputRef.current.value = '';
    }
  };

  const handleUseFirstScreenshot = () => {
    const firstStep = sortedSteps[0];
    if (firstStep?.imageUrl) {
      updateGuide({ id: guideId, coverImageUrl: firstStep.imageUrl });
      toast({ title: 'Thumbnail set to first step screenshot' });
    } else {
      toast({ title: 'No screenshot available in first step', variant: 'destructive' });
    }
  };

  const handleClearThumbnail = () => {
    updateGuide({ id: guideId, coverImageUrl: null });
    toast({ title: 'Thumbnail removed' });
  };

  // Auto-select first step on load
  useEffect(() => {
    if (steps && steps.length > 0 && !selectedStepId) {
      setSelectedStepId(steps[0].id);
    }
  }, [steps]);

  // Sort steps by order
  const sortedSteps = steps ? [...steps].sort((a, b) => a.order - b.order) : [];
  const selectedStep = sortedSteps.find(s => s.id === selectedStepId);
  
  // Current thumbnail - use coverImageUrl or fall back to first step screenshot
  const currentThumbnail = guide?.coverImageUrl || sortedSteps[0]?.imageUrl || null;

  const handleAddStep = () => {
    if (isCreatingStep) return;
    const newOrder = (sortedSteps?.length || 0) + 1;
    createStep({
      guideId,
      order: newOrder,
      title: "New Step",
      actionType: "click",
      imageUrl: `https://placehold.co/800x600/f3f4f6/a3a3a3?text=Step+${newOrder}`
    }, {
      onSuccess: (newStep) => {
        setSelectedStepId(newStep.id);
        toast({ title: "Step added" });
      },
      onError: () => {
        toast({ title: "Failed to add step", variant: "destructive" });
      }
    });
  };

  const handleInsertStep = (afterIndex: number) => {
    if (isCreatingStep) return;
    const currentSteps = [...sortedSteps];
    const newOrder = currentSteps.length + 1;
    const displayNumber = afterIndex + 2;
    
    createStep({
      guideId,
      order: newOrder,
      title: "New Step",
      actionType: "click",
      imageUrl: `https://placehold.co/800x600/f3f4f6/a3a3a3?text=Step+${displayNumber}`
    }, {
      onSuccess: (newStep) => {
        const beforeIds = currentSteps.slice(0, afterIndex + 1).map(s => s.id);
        const afterIds = currentSteps.slice(afterIndex + 1).map(s => s.id);
        const newStepOrder = [...beforeIds, newStep.id, ...afterIds];
        
        reorderSteps({ guideId, stepIds: newStepOrder }, {
          onSuccess: () => {
            setSelectedStepId(newStep.id);
            toast({ title: "Step inserted" });
          },
          onError: () => {
            setSelectedStepId(newStep.id);
            toast({ title: "Step added but reordering failed", variant: "destructive" });
          }
        });
      },
      onError: () => {
        toast({ title: "Failed to add step", variant: "destructive" });
      }
    });
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination || !sortedSteps) return;

    const items = Array.from(sortedSteps);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Optimistic update locally could be done here, but for now we just call API
    reorderSteps({ guideId, stepIds: items.map(i => i.id) });
  };

  const handleAiMagic = () => {
    if (!selectedStep) return;
    generateDesc({
      stepTitle: selectedStep.title || "Unknown Step",
      actionType: selectedStep.actionType,
      context: selectedStep.description || ""
    }, {
      onSuccess: (data) => {
        updateStep({ id: selectedStep.id, guideId, description: data.description });
      }
    });
  };

  if (guideLoading || stepsLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Loading editor...</div>;
  }

  if (!guide) return <div>Flow not found</div>;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top Bar */}
      <header className="min-h-16 border-b border-border bg-card flex flex-wrap items-center justify-between px-2 sm:px-4 py-2 shrink-0 z-30 gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              // Use browser history if available, fallback to /guides
              if (window.history.length > 1) {
                window.history.back();
              } else {
                window.location.href = '/guides';
              }
            }}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-8 w-px bg-border hidden sm:block" />
          <Input 
            value={guide.title} 
            onChange={(e) => updateGuide({ id: guideId, title: e.target.value })}
            className="text-base sm:text-lg font-bold border-none bg-transparent shadow-none focus-visible:ring-0 px-0 min-w-0 flex-1 max-w-xs sm:max-w-sm lg:max-w-md font-display"
          />
          
          {collections && collections.length > 0 && (
            <Select
              value={guide.collectionId?.toString() || "none"}
              onValueChange={(value) => {
                const collectionId = value === "none" ? null : parseInt(value);
                moveFlowToCollection({ flowId: guideId, collectionId });
              }}
            >
              <SelectTrigger className="w-auto min-w-[140px] max-w-[180px] h-8 text-xs hidden md:flex" data-testid="select-collection">
                <FolderOpen className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                <SelectValue placeholder="No Collection" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Collection</SelectItem>
                {collections.map((collection) => (
                  <SelectItem key={collection.id} value={collection.id.toString()}>
                    <span className="flex items-center gap-2">
                      {collection.color && (
                        <span 
                          className="h-2 w-2 rounded-full shrink-0" 
                          style={{ backgroundColor: collection.color }}
                        />
                      )}
                      {collection.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
          {isCapturing && (
            <div className={cn(
              "flex items-center gap-2 px-2 sm:px-3 py-1 rounded-full mr-1 sm:mr-2",
              isPaused 
                ? "bg-yellow-500/10 border border-yellow-500/30" 
                : "bg-red-500/10 border border-red-500/30"
            )}>
              <span className="relative flex h-2 w-2">
                {!isPaused && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                )}
                <span className={cn(
                  "relative inline-flex rounded-full h-2 w-2",
                  isPaused ? "bg-yellow-500" : "bg-red-500"
                )}></span>
              </span>
              <span className={cn(
                "text-xs sm:text-sm font-medium",
                isPaused ? "text-yellow-600" : "text-red-600"
              )}>
                {isPaused ? "Paused" : "Capturing"}
              </span>
              {captureStatus?.eventsReceived > 0 && (
                <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">
                  ({captureStatus.eventsReceived} steps)
                </span>
              )}
            </div>
          )}
          
          {isCapturing ? (
            <>
              <Button 
                size="sm" 
                variant="outline"
                onClick={async () => {
                  const success = isPaused ? await resumeCapture() : await pauseCapture();
                  if (!success) {
                    toast({
                      title: isPaused ? "Failed to resume" : "Failed to pause",
                      description: "The extension did not respond. Please try again.",
                      variant: "destructive"
                    });
                  }
                }}
                data-testid="button-pause-capture"
              >
                {isPaused ? (
                  <Play className="h-4 w-4 sm:mr-2" />
                ) : (
                  <Pause className="h-4 w-4 sm:mr-2" />
                )}
                <span className="hidden sm:inline">{isPaused ? "Resume" : "Pause"}</span>
              </Button>
              <Button 
                size="sm" 
                variant="destructive"
                onClick={() => stopCaptureMutation.mutate()}
                disabled={stopCaptureMutation.isPending}
                data-testid="button-stop-capture"
              >
                {stopCaptureMutation.isPending ? (
                  <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
                ) : (
                  <Square className="h-4 w-4 sm:mr-2" />
                )}
                <span className="hidden sm:inline">Stop</span>
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setShowCancelConfirm(true)}
                data-testid="button-cancel-capture"
              >
                <X className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Cancel</span>
              </Button>
            </>
          ) : (
            <Button 
              size="sm" 
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => {
                if (isExtensionInstalled === false) {
                  setShowExtensionDialog(true);
                  return;
                }
                // Check permissions before starting capture
                if (permissionStatus === 'denied') {
                  setShowPermissionDialog(true);
                  return;
                }
                // If permissions unknown, request them first
                if (permissionStatus !== 'granted') {
                  const granted = await requestPermissions();
                  if (!granted) {
                    setShowPermissionDialog(true);
                    return;
                  }
                }
                startCaptureMutation.mutate();
              }}
              disabled={startCaptureMutation.isPending}
              data-testid="button-start-capture"
            >
              {startCaptureMutation.isPending ? (
                <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
              ) : (
                <Video className="h-4 w-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">Capture</span>
            </Button>
          )}
          
          <div className="h-6 w-px bg-border mx-1 hidden lg:block" />
          
          {/* Desktop buttons - hidden on smaller screens */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setTranslationDialogOpen(true)}
            data-testid="button-translate-guide"
            className="hidden xl:flex"
          >
            <Languages className="h-4 w-4 xl:mr-2" /> <span className="hidden xl:inline">Translate</span>
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setVoiceoverDialogOpen(true)}
            data-testid="button-voiceover-guide"
            className="hidden xl:flex"
          >
            <Volume2 className="h-4 w-4 xl:mr-2" /> <span className="hidden xl:inline">Voice</span>
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setRedactionDialogOpen(true)}
            data-testid="button-redact-guide"
            className="hidden xl:flex"
          >
            <EyeOff className="h-4 w-4 xl:mr-2" /> <span className="hidden xl:inline">Redact</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setKbConvertDialogOpen(true)}
            data-testid="button-publish-to-kb"
            className="hidden xl:flex"
          >
            <BookOpen className="h-4 w-4 xl:mr-2" /> <span className="hidden xl:inline">Publish to KB</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVersionHistoryOpen(true)}
            data-testid="button-version-history"
            className="hidden xl:flex"
          >
            <History className="h-4 w-4 xl:mr-2" /> <span className="hidden xl:inline">History</span>
          </Button>

          {/* Mobile dropdown for additional options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                className="xl:hidden" 
                data-testid="button-more-options"
                aria-label="More options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setTranslationDialogOpen(true)} data-testid="menu-translate">
                <Languages className="h-4 w-4 mr-2" /> Translate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setVoiceoverDialogOpen(true)} data-testid="menu-voiceover">
                <Volume2 className="h-4 w-4 mr-2" /> Voice-over
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRedactionDialogOpen(true)} data-testid="menu-redact">
                <EyeOff className="h-4 w-4 mr-2" /> Redact Data
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setKbConvertDialogOpen(true)} data-testid="menu-publish-kb">
                <BookOpen className="h-4 w-4 mr-2" /> Publish to KB
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setVersionHistoryOpen(true)} data-testid="menu-version-history">
                <History className="h-4 w-4 mr-2" /> Version History
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShareDialogOpen(true)} data-testid="menu-share">
                <Share2 className="h-4 w-4 mr-2" /> Share
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSettingsDialogOpen(true)} data-testid="menu-settings">
                <Settings className="h-4 w-4 mr-2" /> Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Always visible buttons */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShareDialogOpen(true)}
            data-testid="button-share-guide"
            className="hidden xl:flex"
          >
            <Share2 className="h-4 w-4 mr-2" /> Share
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setSettingsDialogOpen(true)}
            data-testid="button-settings-guide"
            className="hidden sm:flex xl:hidden"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button size="sm" className="bg-brand-600 hover:bg-brand-700">
            <Save className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Publish</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Mobile Step Navigation - visible only on small screens */}
        <div className="md:hidden flex items-center gap-2 p-2 border-b border-border bg-muted/30 shrink-0 overflow-x-auto">
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={handleAddStep}
            disabled={isCreatingStep}
            className="h-8 shrink-0"
            data-testid="button-add-step-mobile"
            aria-label="Add step"
          >
            {isCreatingStep ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
          <div className="flex gap-1.5 overflow-x-auto">
            {sortedSteps.map((step, index) => (
              <Button
                key={step.id}
                size="sm"
                variant={selectedStepId === step.id ? "default" : "outline"}
                onClick={() => setSelectedStepId(step.id)}
                className={cn(
                  "h-8 min-w-[40px] px-2 shrink-0",
                  selectedStepId === step.id && "bg-brand-600"
                )}
                data-testid={`button-step-mobile-${step.id}`}
              >
                {index + 1}
              </Button>
            ))}
          </div>
        </div>

        {/* Left Panel: Step List - hidden on mobile */}
        <div className="hidden md:flex w-56 lg:w-72 border-r border-border bg-muted/10 flex-col shrink-0">
          <div className="p-4 border-b border-border flex items-center justify-between gap-2">
            <h3 className="font-semibold text-sm">Steps ({sortedSteps.length})</h3>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handleAddStep} 
              disabled={isCreatingStep}
              className="h-8 w-8 p-0"
              data-testid="button-add-step"
            >
              {isCreatingStep ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            {sortedSteps.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <div className="w-12 h-12 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center mb-3">
                  <Play className="h-6 w-6 text-brand-600" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">Ready to capture</p>
                <p className="text-xs text-muted-foreground mb-3">Start capturing to create steps</p>
                <Button 
                  onClick={async () => {
                    if (isExtensionInstalled === false) {
                      setShowExtensionDialog(true);
                      return;
                    }
                    if (permissionStatus === 'denied') {
                      setShowPermissionDialog(true);
                      return;
                    }
                    if (permissionStatus !== 'granted') {
                      const granted = await requestPermissions();
                      if (!granted) {
                        setShowPermissionDialog(true);
                        return;
                      }
                    }
                    startCaptureMutation.mutate();
                  }} 
                  disabled={startCaptureMutation.isPending || isCapturing}
                  size="sm"
                  className="bg-brand-600 hover:bg-brand-700"
                  data-testid="button-start-capture-sidebar"
                >
                  {startCaptureMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Start Capturing
                </Button>
              </div>
            ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="steps">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1">
                    {sortedSteps.map((step, index) => (
                      <div key={step.id}>
                        <Draggable draggableId={String(step.id)} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              onClick={() => setSelectedStepId(step.id)}
                              className={cn(
                                "relative group p-3 rounded-lg border transition-all cursor-pointer",
                                selectedStepId === step.id 
                                  ? "bg-card border-brand-500 shadow-sm ring-1 ring-brand-500/20" 
                                  : "bg-card border-transparent hover:border-border hover:shadow-sm",
                                snapshot.isDragging && "shadow-xl rotate-2 scale-105 z-50"
                              )}
                            >
                              <div className="flex gap-3">
                                <div {...provided.dragHandleProps} className="mt-1 text-muted-foreground/50 hover:text-foreground cursor-grab">
                                  <GripVertical className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold shrink-0">
                                      {index + 1}
                                    </span>
                                    <span className="font-medium text-sm truncate">{step.title || "Untitled Step"}</span>
                                  </div>
                                  <div className="h-16 w-full bg-muted rounded overflow-hidden relative">
                                    {step.imageUrl ? (
                                      <img src={step.imageUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center bg-muted/50">
                                        <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                        <div className="flex items-center justify-center py-1 group/insert">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleInsertStep(index); }}
                            disabled={isCreatingStep}
                            className={cn(
                              "flex items-center gap-1 px-2 py-0.5 rounded text-xs text-muted-foreground",
                              "opacity-0 group-hover/insert:opacity-100 transition-opacity",
                              "hover:bg-brand-100 hover:text-brand-700 dark:hover:bg-brand-900 dark:hover:text-brand-300",
                              isCreatingStep && "cursor-not-allowed opacity-50"
                            )}
                            data-testid={`button-insert-step-${index}`}
                          >
                            {isCreatingStep ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Plus className="h-3 w-3" />
                            )}
                            <span>Insert step</span>
                          </button>
                        </div>
                      </div>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
            )}
          </div>
        </div>

        {/* Center: Main Canvas */}
        <div className="flex-1 bg-muted/30 p-4 sm:p-6 lg:p-8 flex items-center justify-center overflow-auto relative">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
          
          {selectedStep ? (
            <motion.div 
              key={selectedStep.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-4xl bg-card rounded-lg shadow-2xl border border-border overflow-hidden"
            >
              <div className="aspect-video bg-gray-100 relative group/img overflow-hidden">
                {/* Image upload loading overlay */}
                {imageUploading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-white" />
                      <span className="text-white text-sm">Uploading...</span>
                    </div>
                  </div>
                )}
                
                {selectedStep.imageUrl ? (
                  <>
                    <img src={selectedStep.imageUrl} alt="Step preview" className="w-full h-full object-contain bg-gray-900" />
                    
                    {/* Element zoom animation for element captures */}
                    {selectedStep.metadata && (selectedStep.metadata as any).isElementCapture && (
                      <ElementZoomAnimation
                        elementBounds={(selectedStep.metadata as any).elementBounds}
                        borderColor={(selectedStep.metadata as any).borderColor || "#ef4444"}
                        isElementCapture={(selectedStep.metadata as any).isElementCapture}
                      />
                    )}
                    
                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/40 transition-all flex items-center justify-center invisible group-hover/img:visible z-20">
                      <div className="flex gap-2">
                        <Button 
                          variant="secondary"
                          size="sm"
                          onClick={() => openBeautifier(selectedStep.imageUrl!)}
                          data-testid="button-beautify-screenshot"
                          disabled={imageUploading}
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Beautify
                        </Button>
                        <Button 
                          variant="secondary"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          data-testid="button-replace-screenshot"
                          disabled={imageUploading}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Replace
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-16 w-16 mb-4 opacity-20" />
                    <p>No image captured</p>
                    <Button 
                      variant="outline" 
                      className="mt-4" 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={imageUploading}
                    >
                      {imageUploading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Upload Screenshot
                    </Button>
                  </div>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  data-testid="input-upload-screenshot"
                />
                
                {/* Simulated Annotation Overlay */}
                {selectedStep.selector && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-12 border-4 border-brand-500 rounded-lg shadow-[0_0_0_1000px_rgba(0,0,0,0.5)]">
                    <div className="absolute -top-10 left-0 bg-brand-500 text-white px-3 py-1 rounded text-sm font-bold shadow-lg">
                      Click here
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : sortedSteps.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center max-w-md">
              <div className="w-20 h-20 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center mb-6">
                <Play className="h-10 w-10 text-brand-600" />
              </div>
              <h2 className="text-2xl font-display font-bold text-foreground mb-2">Start Capturing Your Workflow</h2>
              <p className="text-muted-foreground mb-6">
                Click the button below, then perform your workflow in any browser tab. 
                We'll capture every click with screenshots and AI-generated descriptions.
              </p>
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <Button
                  size="lg"
                  className="w-full rounded-xl bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-500/20"
                  onClick={async () => {
                    if (isExtensionInstalled === false) {
                      setShowExtensionDialog(true);
                      return;
                    }
                    if (permissionStatus === 'denied') {
                      setShowPermissionDialog(true);
                      return;
                    }
                    if (permissionStatus !== 'granted') {
                      const granted = await requestPermissions();
                      if (!granted) {
                        setShowPermissionDialog(true);
                        return;
                      }
                    }
                    startCaptureMutation.mutate();
                  }}
                  disabled={startCaptureMutation.isPending || isCapturing}
                  data-testid="button-start-capture-main"
                >
                  {startCaptureMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-5 w-5" />
                      Start Capturing
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full rounded-xl"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-upload-screenshots-main"
                >
                  <Upload className="mr-2 h-5 w-5" />
                  Or Upload Screenshots
                </Button>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-4 text-left w-full max-w-sm">
                <div className="flex items-start gap-2">
                  <ClipboardList className="h-4 w-4 text-brand-600 mt-0.5 shrink-0" />
                  <span className="text-xs text-muted-foreground">SOPs & Procedures</span>
                </div>
                <div className="flex items-start gap-2">
                  <GraduationCap className="h-4 w-4 text-brand-600 mt-0.5 shrink-0" />
                  <span className="text-xs text-muted-foreground">Training Guides</span>
                </div>
                <div className="flex items-start gap-2">
                  <Library className="h-4 w-4 text-brand-600 mt-0.5 shrink-0" />
                  <span className="text-xs text-muted-foreground">Knowledge Bases</span>
                </div>
                <div className="flex items-start gap-2">
                  <HelpCircle className="h-4 w-4 text-brand-600 mt-0.5 shrink-0" />
                  <span className="text-xs text-muted-foreground">How-to Tutorials</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              Select a step to edit
            </div>
          )}
        </div>

        {/* Right Panel: Properties */}
        <div className="w-80 border-l border-border bg-card p-6 flex flex-col shrink-0 overflow-y-auto">
          {selectedStep ? (
            <div className="space-y-6">
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Step Title</label>
                <Input 
                  value={selectedStep.title || ""} 
                  onChange={(e) => updateStep({ id: selectedStep.id, guideId, title: e.target.value })}
                  placeholder="e.g. Click the 'Sign Up' button"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground block">Description</label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2 text-brand-600 hover:text-brand-700 hover:bg-brand-50"
                    onClick={handleAiMagic}
                    disabled={isGenerating}
                  >
                    <Wand2 className="h-3 w-3 mr-1" /> 
                    {isGenerating ? "Magic..." : "AI Improve"}
                  </Button>
                </div>
                <Textarea 
                  value={selectedStep.description || ""}
                  onChange={(e) => updateStep({ id: selectedStep.id, guideId, description: e.target.value })}
                  placeholder="Add more details about this step..."
                  className="min-h-[120px] resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Action Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {['click', 'input', 'scroll'].map(type => (
                    <button
                      key={type}
                      onClick={() => updateStep({ id: selectedStep.id, guideId, actionType: type as any })}
                      className={cn(
                        "px-3 py-2 rounded-md text-sm border transition-all capitalize",
                        selectedStep.actionType === type 
                          ? "bg-brand-50 border-brand-200 text-brand-700 font-medium" 
                          : "bg-background border-border hover:bg-muted"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-border mt-auto">
                 <Button 
                  variant="outline" 
                  className="w-full border-destructive/20 text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    deleteStep({ id: selectedStep.id, guideId });
                    setSelectedStepId(null);
                  }}
                 >
                   <Trash2 className="h-4 w-4 mr-2" /> Delete Step
                 </Button>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Select a step to view properties
            </div>
          )}
        </div>
      </div>

      <Dialog open={beautifierOpen} onOpenChange={setBeautifierOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Beautify Screenshot
            </DialogTitle>
          </DialogHeader>
          {beautifierImageUrl && (
            <ScreenshotBeautifier
              imageUrl={beautifierImageUrl}
              onSave={handleSaveBeautifiedImage}
              onAIAnalysis={handleAIAnalysis}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share Flow
            </DialogTitle>
            <DialogDescription>
              Create a shareable link with optional password protection
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Sharing Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="share-enabled" className="flex flex-col gap-1">
                <span>Enable sharing</span>
                <span className="font-normal text-muted-foreground text-sm">
                  Anyone with the link can view this flow
                </span>
              </Label>
              <Switch
                id="share-enabled"
                checked={shareSettings?.enabled || false}
                onCheckedChange={handleToggleSharing}
                data-testid="switch-share-enabled"
              />
            </div>

            {shareSettings?.enabled && (
              <>
                {/* Share Link */}
                <div className="space-y-2">
                  <Label>Shareable Link</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={shareSettings?.shareUrl || ''} 
                      readOnly 
                      className="flex-1 bg-muted"
                      data-testid="input-share-url"
                    />
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={handleCopyLink}
                      data-testid="button-copy-link"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Password Protection */}
                <div className="space-y-2 pt-4 border-t">
                  <Label className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Password Protection
                  </Label>
                  
                  {shareSettings?.hasPassword ? (
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <span className="text-sm text-muted-foreground">
                        Password is set
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleRemovePassword}
                        data-testid="button-remove-password"
                      >
                        Remove Password
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={sharePassword}
                          onChange={(e) => setSharePassword(e.target.value)}
                          placeholder="Enter a password (optional)"
                          className="pr-10"
                          data-testid="input-share-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <Button 
                        onClick={handleSetPassword}
                        disabled={!sharePassword || updateShareMutation.isPending}
                        className="w-full"
                        data-testid="button-set-password"
                      >
                        {updateShareMutation.isPending ? "Saving..." : "Set Password"}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Access Stats */}
                {shareSettings?.accessCount !== undefined && shareSettings.accessCount > 0 && (
                  <div className="pt-4 border-t text-sm text-muted-foreground">
                    Viewed {shareSettings.accessCount} time{shareSettings.accessCount !== 1 ? 's' : ''}
                    {shareSettings.lastAccessedAt && (
                      <span> (last access: {new Date(shareSettings.lastAccessedAt).toLocaleDateString()})</span>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Export & Embed Section */}
            <div className="space-y-3 pt-4 border-t">
              <Label className="text-sm font-medium">Export & Embed</Label>
              
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={handleGenerateSOP}
                  className="justify-start"
                  data-testid="button-generate-sop"
                >
                  <ClipboardList className="h-4 w-4 mr-1" />
                  SOP
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={handleGenerateTrainingGuide}
                  className="justify-start"
                  data-testid="button-generate-training"
                >
                  <GraduationCap className="h-4 w-4 mr-1" />
                  Training
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={handleGenerateKBArticle}
                  className="justify-start"
                  data-testid="button-generate-kb"
                >
                  <Library className="h-4 w-4 mr-1" />
                  KB Article
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={handleGenerateHowTo}
                  className="justify-start"
                  data-testid="button-generate-howto"
                >
                  <HelpCircle className="h-4 w-4 mr-1" />
                  How-To
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDownloadPdf}
                  className="justify-start"
                  data-testid="button-export-pdf"
                >
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDownloadHtml}
                  className="justify-start"
                  data-testid="button-export-html"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Word (HTML)
                </Button>
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { setEmbedDialogOpen(true); setShareDialogOpen(false); }}
                className="w-full justify-start"
                data-testid="button-embed"
              >
                <Code className="h-4 w-4 mr-2" />
                Embed on website
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Embed Dialog */}
      <Dialog open={embedDialogOpen} onOpenChange={setEmbedDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Embed Flow
            </DialogTitle>
            <DialogDescription>
              Add this flow to any platform that supports embeds or iframes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!shareSettings?.enabled && (
              <div className="flex items-start gap-2 p-3 bg-muted rounded-lg text-sm">
                <Share2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="font-medium">Sharing must be enabled to embed</p>
                  <p className="text-muted-foreground">Enable sharing in the Share dialog first, then come back to get the embed code.</p>
                </div>
              </div>
            )}

            {shareSettings?.enabled && shareSettings?.hasPassword && (
              <div className="flex items-start gap-2 p-3 bg-muted rounded-lg text-sm">
                <Lock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="font-medium">Password-protected flows cannot be embedded</p>
                  <p className="text-muted-foreground">Remove the password to enable embedding, or share the link instead.</p>
                </div>
              </div>
            )}

            {shareSettings?.enabled && !shareSettings?.hasPassword && (
              <>
                <div className="space-y-2">
                  <Label>Embed Code</Label>
                  <div className="relative">
                    <Textarea 
                      value={embedInfo?.embedCode || 'Loading...'} 
                      readOnly 
                      className="font-mono text-xs h-24 resize-none bg-muted"
                      data-testid="textarea-embed-code"
                    />
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      onClick={handleCopyEmbedCode}
                      className="absolute right-2 top-2"
                      disabled={!embedInfo?.embedCode}
                      data-testid="button-copy-embed"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  For platforms that do not support embeds, try sharing a link instead.
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Flow Settings
            </DialogTitle>
            <DialogDescription>
              Configure your flow's thumbnail and display settings.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div>
              <label className="text-sm font-semibold mb-3 block">Thumbnail</label>
              <p className="text-xs text-muted-foreground mb-4">
                Recommended size: 1280 x 720 pixels (16:9 aspect ratio). This image appears in flow lists and when sharing.
              </p>
              
              <div className="aspect-video bg-muted rounded-lg overflow-hidden mb-4 relative">
                {currentThumbnail ? (
                  <img 
                    src={currentThumbnail} 
                    alt="Flow thumbnail" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                    <LayoutGrid className="h-12 w-12 mb-2" />
                    <span className="text-sm">No thumbnail set</span>
                  </div>
                )}
                {thumbnailUploading && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => thumbnailInputRef.current?.click()}
                  disabled={thumbnailUploading}
                  data-testid="button-upload-thumbnail"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Image
                </Button>
                
                {sortedSteps.length > 0 && sortedSteps[0]?.imageUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUseFirstScreenshot}
                    disabled={thumbnailUploading}
                    data-testid="button-use-first-screenshot"
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Use First Screenshot
                  </Button>
                )}
                
                {guide?.coverImageUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearThumbnail}
                    disabled={thumbnailUploading}
                    className="text-destructive"
                    data-testid="button-clear-thumbnail"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                )}
              </div>
              
              <input
                ref={thumbnailInputRef}
                type="file"
                accept="image/*"
                onChange={handleThumbnailUpload}
                className="hidden"
                data-testid="input-thumbnail-file"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* KB Conversion Dialog */}
      <KbConvertDialog
        guide={guide}
        stepsCount={sortedSteps.length}
        open={kbConvertDialogOpen}
        onOpenChange={setKbConvertDialogOpen}
      />

      {/* Translation Dialog */}
      <TranslationDialog 
        guideId={guideId} 
        open={translationDialogOpen} 
        onOpenChange={setTranslationDialogOpen} 
      />

      {/* Voiceover Panel */}
      <VoiceoverPanel 
        guideId={guideId} 
        steps={sortedSteps.map(s => ({
          id: s.id,
          title: s.title,
          description: s.description,
          order: s.order
        }))}
        open={voiceoverDialogOpen} 
        onOpenChange={setVoiceoverDialogOpen} 
      />

      {/* Redaction Panel */}
      <RedactionPanel 
        guideId={guideId} 
        steps={sortedSteps.map(s => ({
          id: s.id,
          title: s.title,
          description: s.description,
          order: s.order,
          imageUrl: s.imageUrl
        }))}
        open={redactionDialogOpen} 
        onOpenChange={setRedactionDialogOpen} 
      />

      {/* Install Extension Dialog */}
      <InstallExtensionDialog 
        open={showExtensionDialog} 
        onOpenChange={setShowExtensionDialog} 
      />

      {/* Permission Denied Dialog */}
      <PermissionDeniedDialog 
        open={showPermissionDialog} 
        onOpenChange={setShowPermissionDialog} 
      />

      {/* Version History Dialog */}
      <VersionHistoryDialog
        guideId={guideId}
        open={versionHistoryOpen}
        onOpenChange={setVersionHistoryOpen}
      />

      {/* Cancel Capture Confirmation Dialog */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Capture?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop capturing and delete all steps captured during this session. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-confirm-no">Keep Capturing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelCaptureMutation.mutate()}
              disabled={cancelCaptureMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-cancel-confirm-yes"
            >
              {cancelCaptureMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Cancel Capture
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Version History Dialog ─────────────────────────────────────────────────
interface GuideVersion {
  id: number;
  versionNumber: number;
  title: string;
  createdAt: string;
  snapshot: unknown;
}

function VersionHistoryDialog({
  guideId,
  open,
  onOpenChange,
}: {
  guideId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const { data: versions = [], isLoading } = useQuery<GuideVersion[]>({
    queryKey: ['/api/guides/:guideId/versions', guideId],
    queryFn: () => fetch(`/api/guides/${guideId}/versions`, { credentials: 'include' }).then(r => r.json()),
    enabled: open && guideId > 0,
  });

  const saveVersionMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', `/api/guides/${guideId}/versions`, { label: `Snapshot ${new Date().toLocaleString()}` }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/guides/:guideId/versions', guideId] });
      toast({ title: 'Version saved' });
    },
    onError: () => toast({ title: 'Failed to save version', variant: 'destructive' }),
  });

  const restoreMutation = useMutation({
    mutationFn: (versionId: number) =>
      apiRequest('POST', `/api/guides/${guideId}/versions/${versionId}/restore`, {}).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/guides', guideId] });
      queryClient.invalidateQueries({ queryKey: ['/api/guides/:guideId/steps', guideId] });
      toast({ title: 'Version restored' });
      onOpenChange(false);
    },
    onError: () => toast({ title: 'Failed to restore version', variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Version History
          </DialogTitle>
          <DialogDescription>Save and restore snapshots of this guide</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button
            onClick={() => saveVersionMutation.mutate()}
            disabled={saveVersionMutation.isPending}
            className="w-full"
            size="sm"
          >
            {saveVersionMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Current Version
          </Button>

          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No versions saved yet. Click "Save Current Version" to create one.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      v{v.versionNumber} — {v.title || 'Untitled'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(v.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => restoreMutation.mutate(v.id)}
                    disabled={restoreMutation.isPending}
                    data-testid={`button-restore-version-${v.id}`}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" /> Restore
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlusIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function KbConvertDialog({ 
  guide, 
  stepsCount, 
  open, 
  onOpenChange 
}: { 
  guide: Guide; 
  stepsCount: number; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(guide.title);
  const [excerpt, setExcerpt] = useState(guide.description || "");
  const [categoryId, setCategoryId] = useState<string>("");
  const [tags, setTags] = useState("");

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setTitle(guide.title);
      setExcerpt(guide.description || "");
      setCategoryId("");
      setTags("");
    }
  }, [open, guide]);

  // Fetch categories for the dropdown
  const { data: categories } = useQuery<KbCategory[]>({
    queryKey: ['/api/kb/categories'],
  });

  const convertMutation = useMutation({
    mutationFn: async (data: { title: string; excerpt: string; categoryId?: number; tags: string[] }) => {
      const res = await apiRequest('POST', `/api/guides/${guide.id}/convert-to-kb`, data);
      return res.json();
    },
    onSuccess: (article) => {
      toast({
        title: "Published to Knowledge Base!",
        description: `"${article.title}" has been created as a draft article. You can edit it in the admin panel.`,
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Conversion failed",
        description: error.message || "Failed to publish flow to Knowledge Base.",
        variant: "destructive",
      });
    },
  });

  const handleConvert = () => {
    const tagsArray = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
    convertMutation.mutate({
      title,
      excerpt,
      categoryId: categoryId ? parseInt(categoryId) : undefined,
      tags: tagsArray,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Publish to Knowledge Base
          </DialogTitle>
          <DialogDescription>
            Convert this flow into a searchable Knowledge Base article. The article will be created as a draft.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="kb-title">Article Title</Label>
            <Input
              id="kb-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter article title"
              data-testid="input-kb-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kb-excerpt">Excerpt / Summary</Label>
            <Textarea
              id="kb-excerpt"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Brief description of what this article covers..."
              className="resize-none"
              rows={3}
              data-testid="input-kb-excerpt"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kb-category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger data-testid="select-kb-category">
                <SelectValue placeholder="Select a category (optional)" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={String(cat.id)} data-testid={`option-category-${cat.id}`}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="kb-tags">Tags (comma-separated)</Label>
            <Input
              id="kb-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. tutorial, workflow, onboarding"
              data-testid="input-kb-tags"
            />
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="font-medium text-sm">Preview</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-500" />
                {stepsCount} step{stepsCount !== 1 ? 's' : ''} will be converted
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-500" />
                Screenshots and descriptions included
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-500" />
                Article created as draft for review
              </li>
            </ul>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-kb-convert"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConvert}
            disabled={!title.trim() || convertMutation.isPending}
            data-testid="button-confirm-kb-convert"
          >
            {convertMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <BookOpen className="h-4 w-4 mr-2" />
                Publish to KB
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
