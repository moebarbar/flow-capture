import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import { 
  Send, Check, X, Edit, Clock, CheckCircle, 
  XCircle, AlertCircle 
} from "lucide-react";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface GuideApproval {
  id: number;
  guideId: number;
  workspaceId: number;
  requestedById: string;
  reviewerId: string | null;
  status: string;
  requestNotes: string | null;
  reviewNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface WorkspaceMember {
  userId: string;
  user: { id: string; email: string; firstName: string | null; lastName: string | null };
  role: string;
}

interface ApprovalWorkflowPanelProps {
  guideId: number;
  workspaceId: number;
  guideTitle: string;
  currentStatus: string;
}

export function ApprovalWorkflowPanel({ 
  guideId, 
  workspaceId, 
  guideTitle,
  currentStatus 
}: ApprovalWorkflowPanelProps) {
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [selectedReviewer, setSelectedReviewer] = useState<string>("");
  const [requestNotes, setRequestNotes] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [selectedApproval, setSelectedApproval] = useState<GuideApproval | null>(null);

  const { data: approvalsData } = useQuery<{ data: GuideApproval[] }>({
    queryKey: ['/api/workspaces', workspaceId, 'approvals'],
    enabled: workspaceId > 0,
  });

  const { data: membersData } = useQuery<{ members: WorkspaceMember[] }>({
    queryKey: ['/api/workspaces', workspaceId, 'team-dashboard'],
    enabled: workspaceId > 0,
  });

  const requestApprovalMutation = useMutation({
    mutationFn: async (payload: { reviewerId?: string; requestNotes?: string }) => {
      return apiRequest('POST', `/api/guides/${guideId}/request-approval`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'approvals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'team-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/guides', guideId] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      setIsRequestDialogOpen(false);
      resetRequestForm();
    },
  });

  const reviewApprovalMutation = useMutation({
    mutationFn: async ({ id, status, reviewNotes }: { id: number; status: string; reviewNotes?: string }) => {
      return apiRequest('POST', `/api/approvals/${id}/review`, { status, reviewNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'approvals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'team-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/guides', guideId] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      setIsReviewDialogOpen(false);
      resetReviewForm();
    },
  });

  const resetRequestForm = () => {
    setSelectedReviewer("");
    setRequestNotes("");
  };

  const resetReviewForm = () => {
    setReviewNotes("");
    setSelectedApproval(null);
  };

  const handleRequestApproval = () => {
    requestApprovalMutation.mutate({
      reviewerId: selectedReviewer || undefined,
      requestNotes: requestNotes || undefined,
    });
  };

  const handleReview = (status: 'approved' | 'rejected' | 'revision_requested') => {
    if (!selectedApproval) return;
    reviewApprovalMutation.mutate({
      id: selectedApproval.id,
      status,
      reviewNotes: reviewNotes || undefined,
    });
  };

  const guideApprovals = approvalsData?.data?.filter(a => a.guideId === guideId) || [];
  const pendingApproval = guideApprovals.find(a => a.status === 'pending');
  const members = membersData?.members || [];
  const adminsAndOwners = members.filter(m => ['owner', 'admin'].includes(m.role));

  const getMemberName = (userId: string) => {
    const member = members.find(m => m.userId === userId);
    if (!member) return 'Unknown';
    if (member.user.firstName && member.user.lastName) {
      return `${member.user.firstName} ${member.user.lastName}`;
    }
    return member.user.email;
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'approved':
        return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50', label: 'Approved' };
      case 'rejected':
        return { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', label: 'Rejected' };
      case 'revision_requested':
        return { icon: Edit, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Revision Requested' };
      default:
        return { icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Pending' };
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Approval Workflow</span>
      </div>

      {pendingApproval ? (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            This guide is pending approval.
            {pendingApproval.reviewerId && (
              <span> Assigned to: {getMemberName(pendingApproval.reviewerId)}</span>
            )}
          </AlertDescription>
        </Alert>
      ) : currentStatus === 'draft' ? (
        <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" data-testid="button-request-approval">
              <Send className="h-4 w-4 mr-2" />
              Request Approval
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Approval</DialogTitle>
              <DialogDescription>
                Submit "{guideTitle}" for review before publishing.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Assign Reviewer (optional)</Label>
                <Select value={selectedReviewer} onValueChange={setSelectedReviewer}>
                  <SelectTrigger data-testid="select-reviewer">
                    <SelectValue placeholder="Select a reviewer" />
                  </SelectTrigger>
                  <SelectContent>
                    {adminsAndOwners.map((member) => (
                      <SelectItem key={member.userId} value={member.userId}>
                        <div className="flex items-center gap-2">
                          <span>{getMemberName(member.userId)}</span>
                          <Badge variant="outline" className="text-xs">
                            {member.role}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  placeholder="Add any context or notes for the reviewer..."
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  className="resize-none"
                  data-testid="input-request-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleRequestApproval}
                disabled={requestApprovalMutation.isPending}
                data-testid="button-submit-request"
              >
                {requestApprovalMutation.isPending ? "Submitting..." : "Submit for Approval"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <Badge variant="default" className="w-full justify-center py-2">
          <CheckCircle className="h-4 w-4 mr-2" />
          Published
        </Badge>
      )}

      {guideApprovals.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">Approval History</span>
          {guideApprovals.map((approval) => {
            const config = getStatusConfig(approval.status);
            const StatusIcon = config.icon;
            return (
              <div 
                key={approval.id} 
                className={`p-3 rounded-md border ${config.bg}`}
                data-testid={`approval-history-${approval.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusIcon className={`h-4 w-4 ${config.color}`} />
                    <span className="text-sm font-medium">{config.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(approval.createdAt), "MMM d, yyyy")}
                  </span>
                </div>
                {approval.requestNotes && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Request: {approval.requestNotes}
                  </p>
                )}
                {approval.reviewNotes && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Review: {approval.reviewNotes}
                  </p>
                )}
                {approval.status === 'pending' && (
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedApproval(approval);
                        setIsReviewDialogOpen(true);
                      }}
                      data-testid={`button-review-${approval.id}`}
                    >
                      Review
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Guide</DialogTitle>
            <DialogDescription>
              Approve, reject, or request revisions for "{guideTitle}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Review Notes (optional)</Label>
              <Textarea
                placeholder="Add feedback or notes..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="resize-none"
                data-testid="input-review-notes"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleReview('revision_requested')}
              disabled={reviewApprovalMutation.isPending}
              data-testid="button-request-revision"
            >
              <Edit className="h-4 w-4 mr-1" />
              Request Revision
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleReview('rejected')}
              disabled={reviewApprovalMutation.isPending}
              data-testid="button-reject"
            >
              <X className="h-4 w-4 mr-1" />
              Reject
            </Button>
            <Button
              onClick={() => handleReview('approved')}
              disabled={reviewApprovalMutation.isPending}
              data-testid="button-approve"
            >
              <Check className="h-4 w-4 mr-1" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
