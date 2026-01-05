import { memo, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Sidebar, useSidebarState, MobileMenuTrigger } from "@/components/Sidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, FileText, CheckCircle, Clock, AlertCircle, 
  Activity, TrendingUp, ClipboardList, UserPlus, X, Send, RotateCw, Mail
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface WorkspaceInvitation {
  id: number;
  workspaceId: number;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  expiresAt: string;
}

interface TeamDashboardStats {
  totalGuides: number;
  publishedGuides: number;
  pendingApprovals: number;
  activeAssignments: number;
  completedAssignments: number;
  recentActivity: Array<{
    id: number;
    userId: string;
    actionType: string;
    resourceType: string;
    resourceId: number;
    metadata: any;
    createdAt: string;
  }>;
  members: Array<{
    userId: string;
    user: { id: string; email: string; firstName: string | null; lastName: string | null };
    role: string;
    totalAssignments: number;
    completedAssignments: number;
    pendingAssignments: number;
  }>;
}

const getInitials = (firstName: string | null, lastName: string | null, email: string): string => {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
};

const formatActionType = (actionType: string): string => {
  const mapping: Record<string, string> = {
    'step_assigned': 'Step assigned to team member',
    'approval_requested': 'Guide submitted for approval',
    'guide_created': 'New guide created',
    'step_completed': 'Step marked as complete',
    'comment_added': 'New comment added',
  };
  return mapping[actionType] || actionType.replace(/_/g, ' ');
};

const StatusIcon = memo(function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />;
    case 'in_progress':
      return <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />;
    case 'overdue':
      return <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />;
  }
});

const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'completed':
      return 'default';
    case 'in_progress':
      return 'secondary';
    case 'overdue':
      return 'destructive';
    default:
      return 'outline';
  }
};

const StatCard = memo(function StatCard({ 
  title, 
  value, 
  subtext, 
  icon: Icon,
  testId 
}: { 
  title: string; 
  value: number; 
  subtext: string; 
  icon: typeof FileText;
  testId: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-xs sm:text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-xl sm:text-2xl font-bold" data-testid={testId}>{value}</div>
        <p className="text-xs text-muted-foreground">{subtext}</p>
      </CardContent>
    </Card>
  );
});

const ActivityItem = memo(function ActivityItem({ 
  activity 
}: { 
  activity: { id: number; actionType: string; createdAt: string } 
}) {
  const formattedTime = useMemo(
    () => formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true }),
    [activity.createdAt]
  );
  
  return (
    <div className="flex items-start gap-2 sm:gap-3 text-sm">
      <div className="rounded-full bg-muted p-1 sm:p-1.5 shrink-0">
        <Activity className="h-3 w-3" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-xs sm:text-sm">
          {formatActionType(activity.actionType)}
        </p>
        <p className="text-xs text-muted-foreground">
          {formattedTime}
        </p>
      </div>
    </div>
  );
});

const MemberCard = memo(function MemberCard({ 
  member 
}: { 
  member: TeamDashboardStats['members'][0] 
}) {
  const initials = useMemo(
    () => getInitials(member.user.firstName, member.user.lastName, member.user.email),
    [member.user.firstName, member.user.lastName, member.user.email]
  );
  
  const displayName = useMemo(() => {
    if (member.user.firstName && member.user.lastName) {
      return `${member.user.firstName} ${member.user.lastName}`;
    }
    return member.user.email;
  }, [member.user.firstName, member.user.lastName, member.user.email]);

  return (
    <div 
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-3 rounded-md border"
      data-testid={`card-member-${member.userId}`}
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
          <AvatarFallback className="text-xs sm:text-sm">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-medium text-sm sm:text-base truncate">{displayName}</p>
          <Badge variant="outline" className="text-xs">{member.role}</Badge>
        </div>
      </div>
      <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm pl-11 sm:pl-0">
        <div className="text-center">
          <p className="font-semibold">{member.totalAssignments}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="text-center">
          <p className="font-semibold text-green-600">{member.completedAssignments}</p>
          <p className="text-xs text-muted-foreground">Done</p>
        </div>
        <div className="text-center">
          <p className="font-semibold text-amber-600">{member.pendingAssignments}</p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </div>
      </div>
    </div>
  );
});

const AssignmentCard = memo(function AssignmentCard({ 
  assignment 
}: { 
  assignment: any 
}) {
  const formattedDue = useMemo(() => {
    if (!assignment.dueDate) return null;
    return formatDistanceToNow(new Date(assignment.dueDate), { addSuffix: true });
  }, [assignment.dueDate]);

  return (
    <div 
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 p-3 rounded-md border"
      data-testid={`card-assignment-${assignment.id}`}
    >
      <div className="flex items-center gap-3">
        <StatusIcon status={assignment.status} />
        <div className="min-w-0">
          <p className="font-medium text-sm sm:text-base">Step #{assignment.stepId}</p>
          {assignment.notes && (
            <p className="text-xs sm:text-sm text-muted-foreground truncate max-w-xs">
              {assignment.notes}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 pl-7 sm:pl-0">
        <Badge variant={getStatusVariant(assignment.status)} className="text-xs">
          {assignment.status}
        </Badge>
        {formattedDue && (
          <span className="text-xs text-muted-foreground hidden sm:inline">Due {formattedDue}</span>
        )}
      </div>
    </div>
  );
});

const ApprovalCard = memo(function ApprovalCard({ 
  approval 
}: { 
  approval: any 
}) {
  return (
    <div 
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 p-3 rounded-md border"
      data-testid={`card-approval-${approval.id}`}
    >
      <div className="flex items-center gap-3">
        <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium text-sm sm:text-base">Guide #{approval.guideId}</p>
          {approval.requestNotes && (
            <p className="text-xs sm:text-sm text-muted-foreground truncate max-w-xs">
              {approval.requestNotes}
            </p>
          )}
        </div>
      </div>
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 self-start sm:self-auto text-xs">
        Pending Review
      </Badge>
    </div>
  );
});

export default function TeamDashboard() {
  const params = useParams();
  const workspaceId = useMemo(() => parseInt(params.workspaceId || "0"), [params.workspaceId]);
  const { isCollapsed } = useSidebarState();
  const { toast } = useToast();
  
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("editor");

  const { data: stats, isLoading } = useQuery<TeamDashboardStats>({
    queryKey: ['/api/workspaces', workspaceId, 'team-dashboard'],
    enabled: workspaceId > 0,
    staleTime: 30000,
  });

  const { data: assignments } = useQuery<{ data: any[] }>({
    queryKey: ['/api/workspaces', workspaceId, 'assignments'],
    enabled: workspaceId > 0,
    staleTime: 30000,
  });

  const { data: approvals } = useQuery<{ data: any[] }>({
    queryKey: ['/api/workspaces', workspaceId, 'approvals'],
    enabled: workspaceId > 0,
    staleTime: 30000,
  });

  const { data: invitations } = useQuery<WorkspaceInvitation[]>({
    queryKey: ['/api/workspaces', workspaceId, 'invitations'],
    enabled: workspaceId > 0,
    staleTime: 30000,
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      return await apiRequest('POST', `/api/workspaces/${workspaceId}/invitations`, { email, role });
    },
    onSuccess: () => {
      toast({ title: "Invitation sent", description: "Team member has been invited" });
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'invitations'] });
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("editor");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to send invitation", description: err.message, variant: "destructive" });
    },
  });

  const cancelInviteMutation = useMutation({
    mutationFn: async (invitationId: number) => {
      return await apiRequest('DELETE', `/api/invitations/${invitationId}`);
    },
    onSuccess: () => {
      toast({ title: "Invitation cancelled" });
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'invitations'] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to cancel invitation", description: err.message, variant: "destructive" });
    },
  });

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;
    inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
  };

  const pendingInvitations = useMemo(() => {
    return invitations?.filter(inv => inv.status === 'pending') || [];
  }, [invitations]);

  const completionRate = useMemo(() => {
    if (!stats || stats.totalGuides === 0) return 0;
    return Math.round((stats.publishedGuides / stats.totalGuides) * 100);
  }, [stats?.totalGuides, stats?.publishedGuides]);

  const assignmentCompletionRate = useMemo(() => {
    if (!stats) return 0;
    const total = stats.activeAssignments + stats.completedAssignments;
    if (total === 0) return 0;
    return Math.round((stats.completedAssignments / total) * 100);
  }, [stats?.activeAssignments, stats?.completedAssignments]);

  const activeAssignments = useMemo(() => {
    return assignments?.data?.filter(a => a.status !== 'completed') || [];
  }, [assignments?.data]);

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className={cn(
        "flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto transition-all duration-200",
        "lg:ml-64",
        isCollapsed && "lg:ml-16"
      )}>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
            <div className="flex items-start sm:items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <MobileMenuTrigger />
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-dashboard-title">Team Dashboard</h1>
                  <p className="text-muted-foreground text-sm">Track team progress and collaboration</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-invite-member">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Invite Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Invite Team Member</DialogTitle>
                      <DialogDescription>
                        Send an invitation to join your workspace. They will be billed $7/month starting from today.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="invite-email">Email address</Label>
                        <Input
                          id="invite-email"
                          type="email"
                          placeholder="colleague@company.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          data-testid="input-invite-email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="invite-role">Role</Label>
                        <Select value={inviteRole} onValueChange={setInviteRole}>
                          <SelectTrigger id="invite-role" data-testid="select-invite-role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer - Can view guides only</SelectItem>
                            <SelectItem value="editor">Editor - Can create and edit guides</SelectItem>
                            <SelectItem value="admin">Admin - Full workspace access</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleInvite} 
                        disabled={inviteMutation.isPending || !inviteEmail.trim()}
                        data-testid="button-send-invite"
                      >
                        {inviteMutation.isPending ? (
                          <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        Send Invitation
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <NotificationBell />
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard 
                title="Total Guides" 
                value={stats?.totalGuides || 0} 
                subtext={`${stats?.publishedGuides || 0} published`}
                icon={FileText}
                testId="text-total-guides"
              />
              <StatCard 
                title="Pending Approvals" 
                value={stats?.pendingApprovals || 0} 
                subtext="Awaiting review"
                icon={Clock}
                testId="text-pending-approvals"
              />
              <StatCard 
                title="Active Assignments" 
                value={stats?.activeAssignments || 0} 
                subtext="In progress"
                icon={ClipboardList}
                testId="text-active-assignments"
              />
              <StatCard 
                title="Team Members" 
                value={stats?.members?.length || 0} 
                subtext="Active collaborators"
                icon={Users}
                testId="text-team-members"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <Card>
                <CardHeader className="pb-2 sm:pb-4">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
                    Progress Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs sm:text-sm font-medium">Guide Completion</span>
                      <span className="text-xs sm:text-sm text-muted-foreground">{completionRate}%</span>
                    </div>
                    <Progress value={completionRate} className="h-2" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs sm:text-sm font-medium">Assignment Completion</span>
                      <span className="text-xs sm:text-sm text-muted-foreground">{assignmentCompletionRate}%</span>
                    </div>
                    <Progress value={assignmentCompletionRate} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 sm:pb-4">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[150px] sm:h-[200px]">
                    {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                      <div className="space-y-2 sm:space-y-3">
                        {stats.recentActivity.map((activity) => (
                          <ActivityItem key={activity.id} activity={activity} />
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Activity className="h-6 w-6 sm:h-8 sm:w-8 mb-2" />
                        <p className="text-xs sm:text-sm">No recent activity</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="members" className="space-y-4">
              <TabsList className="w-full sm:w-auto overflow-x-auto">
                <TabsTrigger value="members" data-testid="tab-members" className="text-xs sm:text-sm">Team Members</TabsTrigger>
                <TabsTrigger value="invitations" data-testid="tab-invitations" className="text-xs sm:text-sm">
                  Pending Invites {pendingInvitations.length > 0 && `(${pendingInvitations.length})`}
                </TabsTrigger>
                <TabsTrigger value="assignments" data-testid="tab-assignments" className="text-xs sm:text-sm">Assignments</TabsTrigger>
                <TabsTrigger value="approvals" data-testid="tab-approvals" className="text-xs sm:text-sm">Pending Approvals</TabsTrigger>
              </TabsList>

              <TabsContent value="members">
                <Card>
                  <CardHeader className="pb-2 sm:pb-4">
                    <CardTitle className="text-base sm:text-lg">Team Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 sm:space-y-4">
                      {stats?.members?.map((member) => (
                        <MemberCard key={member.userId} member={member} />
                      ))}
                      {(!stats?.members || stats.members.length === 0) && (
                        <div className="text-center text-muted-foreground py-6 sm:py-8">
                          <Users className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No team members yet</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="invitations">
                <Card>
                  <CardHeader className="pb-2 sm:pb-4">
                    <CardTitle className="text-base sm:text-lg">Pending Invitations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 sm:space-y-4">
                      {pendingInvitations.map((invitation) => (
                        <div 
                          key={invitation.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-3 rounded-md border"
                          data-testid={`card-invitation-${invitation.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="rounded-full bg-muted p-2">
                              <Mail className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm sm:text-base truncate">{invitation.email}</p>
                              <p className="text-xs text-muted-foreground">
                                Invited {formatDistanceToNow(new Date(invitation.createdAt), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pl-11 sm:pl-0">
                            <Badge variant="outline" className="text-xs">{invitation.role}</Badge>
                            <Badge variant="secondary" className="text-xs">Pending</Badge>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => cancelInviteMutation.mutate(invitation.id)}
                              disabled={cancelInviteMutation.isPending}
                              data-testid={`button-cancel-invite-${invitation.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {pendingInvitations.length === 0 && (
                        <div className="text-center text-muted-foreground py-6 sm:py-8">
                          <Mail className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No pending invitations</p>
                          <Button 
                            variant="outline" 
                            className="mt-4"
                            onClick={() => setInviteDialogOpen(true)}
                          >
                            <UserPlus className="h-4 w-4 mr-2" />
                            Invite Someone
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="assignments">
                <Card>
                  <CardHeader className="pb-2 sm:pb-4">
                    <CardTitle className="text-base sm:text-lg">Active Assignments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 sm:space-y-3">
                      {activeAssignments.map((assignment) => (
                        <AssignmentCard key={assignment.id} assignment={assignment} />
                      ))}
                      {activeAssignments.length === 0 && (
                        <div className="text-center text-muted-foreground py-6 sm:py-8">
                          <CheckCircle className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No active assignments</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="approvals">
                <Card>
                  <CardHeader className="pb-2 sm:pb-4">
                    <CardTitle className="text-base sm:text-lg">Guides Awaiting Approval</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 sm:space-y-3">
                      {approvals?.data?.map((approval) => (
                        <ApprovalCard key={approval.id} approval={approval} />
                      ))}
                      {(!approvals?.data || approvals.data.length === 0) && (
                        <div className="text-center text-muted-foreground py-6 sm:py-8">
                          <CheckCircle className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No pending approvals</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
}
