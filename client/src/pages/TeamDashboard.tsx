import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Users, FileText, CheckCircle, Clock, AlertCircle, 
  Activity, TrendingUp, ClipboardList
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

export default function TeamDashboard() {
  const params = useParams();
  const workspaceId = parseInt(params.workspaceId || "0");

  const { data: stats, isLoading } = useQuery<TeamDashboardStats>({
    queryKey: ['/api/workspaces', workspaceId, 'team-dashboard'],
    enabled: workspaceId > 0,
  });

  const { data: assignments } = useQuery<{ data: any[] }>({
    queryKey: ['/api/workspaces', workspaceId, 'assignments'],
    enabled: workspaceId > 0,
  });

  const { data: approvals } = useQuery<{ data: any[] }>({
    queryKey: ['/api/workspaces', workspaceId, 'approvals'],
    enabled: workspaceId > 0,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const completionRate = stats && stats.totalGuides > 0 
    ? Math.round((stats.publishedGuides / stats.totalGuides) * 100) 
    : 0;

  const assignmentCompletionRate = stats && (stats.activeAssignments + stats.completedAssignments) > 0
    ? Math.round((stats.completedAssignments / (stats.activeAssignments + stats.completedAssignments)) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Team Dashboard</h1>
          <p className="text-muted-foreground">Track team progress and collaboration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Guides</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-guides">{stats?.totalGuides || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.publishedGuides || 0} published
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pending-approvals">{stats?.pendingApprovals || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Assignments</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-assignments">{stats?.activeAssignments || 0}</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-team-members">{stats?.members?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Active collaborators</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Progress Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm font-medium">Guide Completion</span>
                <span className="text-sm text-muted-foreground">{completionRate}%</span>
              </div>
              <Progress value={completionRate} className="h-2" />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm font-medium">Assignment Completion</span>
                <span className="text-sm text-muted-foreground">{assignmentCompletionRate}%</span>
              </div>
              <Progress value={assignmentCompletionRate} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {stats.recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 text-sm">
                      <div className="rounded-full bg-muted p-1.5">
                        <Activity className="h-3 w-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {formatActionType(activity.actionType)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Activity className="h-8 w-8 mb-2" />
                  <p className="text-sm">No recent activity</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members" data-testid="tab-members">Team Members</TabsTrigger>
          <TabsTrigger value="assignments" data-testid="tab-assignments">Assignments</TabsTrigger>
          <TabsTrigger value="approvals" data-testid="tab-approvals">Pending Approvals</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Team Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.members?.map((member) => (
                  <div 
                    key={member.userId} 
                    className="flex items-center justify-between gap-4 p-3 rounded-md border"
                    data-testid={`card-member-${member.userId}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {getInitials(member.user.firstName, member.user.lastName, member.user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {member.user.firstName && member.user.lastName 
                            ? `${member.user.firstName} ${member.user.lastName}`
                            : member.user.email}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {member.role}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
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
                ))}
                {(!stats?.members || stats.members.length === 0) && (
                  <div className="text-center text-muted-foreground py-8">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No team members yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments">
          <Card>
            <CardHeader>
              <CardTitle>Active Assignments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {assignments?.data?.filter(a => a.status !== 'completed').map((assignment) => (
                  <div 
                    key={assignment.id} 
                    className="flex items-center justify-between gap-4 p-3 rounded-md border"
                    data-testid={`card-assignment-${assignment.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <StatusIcon status={assignment.status} />
                      <div>
                        <p className="font-medium">Step #{assignment.stepId}</p>
                        {assignment.notes && (
                          <p className="text-sm text-muted-foreground truncate max-w-xs">
                            {assignment.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={getStatusVariant(assignment.status)}>
                        {assignment.status}
                      </Badge>
                      {assignment.dueDate && (
                        <span className="text-xs text-muted-foreground">
                          Due {formatDistanceToNow(new Date(assignment.dueDate), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {(!assignments?.data || assignments.data.filter(a => a.status !== 'completed').length === 0) && (
                  <div className="text-center text-muted-foreground py-8">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No active assignments</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <CardTitle>Guides Awaiting Approval</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {approvals?.data?.map((approval) => (
                  <div 
                    key={approval.id} 
                    className="flex items-center justify-between gap-4 p-3 rounded-md border"
                    data-testid={`card-approval-${approval.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                      <div>
                        <p className="font-medium">Guide #{approval.guideId}</p>
                        {approval.requestNotes && (
                          <p className="text-sm text-muted-foreground truncate max-w-xs">
                            {approval.requestNotes}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      Pending Review
                    </Badge>
                  </div>
                ))}
                {(!approvals?.data || approvals.data.length === 0) && (
                  <div className="text-center text-muted-foreground py-8">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No pending approvals</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function getInitials(firstName: string | null, lastName: string | null, email: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
}

function formatActionType(actionType: string): string {
  const mapping: Record<string, string> = {
    'step_assigned': 'Step assigned to team member',
    'approval_requested': 'Guide submitted for approval',
    'guide_created': 'New guide created',
    'step_completed': 'Step marked as complete',
    'comment_added': 'New comment added',
  };
  return mapping[actionType] || actionType.replace(/_/g, ' ');
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'in_progress':
      return <Activity className="h-5 w-5 text-blue-500" />;
    case 'overdue':
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    default:
      return <Clock className="h-5 w-5 text-amber-500" />;
  }
}

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
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
}
