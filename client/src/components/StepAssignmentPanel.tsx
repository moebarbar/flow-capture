import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  UserPlus, Calendar as CalendarIcon, Check, Clock, 
  AlertCircle, Trash2 
} from "lucide-react";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface StepAssignment {
  id: number;
  stepId: number;
  guideId: number;
  workspaceId: number;
  assigneeId: string;
  assignedById: string;
  status: string;
  dueDate: string | null;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface WorkspaceMember {
  userId: string;
  user: { id: string; email: string; firstName: string | null; lastName: string | null };
  role: string;
}

interface StepAssignmentPanelProps {
  stepId: number;
  guideId: number;
  workspaceId: number;
}

export function StepAssignmentPanel({ stepId, guideId, workspaceId }: StepAssignmentPanelProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState("");

  const { data: assignmentsData } = useQuery<{ data: StepAssignment[] }>({
    queryKey: ['/api/guides', guideId, 'assignments'],
    enabled: guideId > 0,
  });

  const { data: membersData } = useQuery<{ members: WorkspaceMember[] }>({
    queryKey: ['/api/workspaces', workspaceId, 'team-dashboard'],
    enabled: workspaceId > 0,
  });

  const createAssignmentMutation = useMutation({
    mutationFn: async (payload: { assigneeId: string; dueDate?: string; notes?: string }) => {
      return apiRequest('POST', `/api/steps/${stepId}/assignments`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/guides', guideId, 'assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'team-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest('PATCH', `/api/assignments/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/guides', guideId, 'assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'team-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/assignments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/guides', guideId, 'assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'team-dashboard'] });
    },
  });

  const resetForm = () => {
    setSelectedUser("");
    setDueDate(undefined);
    setNotes("");
  };

  const handleCreateAssignment = () => {
    if (!selectedUser) return;
    createAssignmentMutation.mutate({
      assigneeId: selectedUser,
      dueDate: dueDate?.toISOString(),
      notes: notes || undefined,
    });
  };

  const stepAssignments = assignmentsData?.data?.filter(a => a.stepId === stepId) || [];
  const members = membersData?.members || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check className="h-3 w-3 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-3 w-3 text-blue-500" />;
      case 'overdue':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      default:
        return <Clock className="h-3 w-3 text-amber-500" />;
    }
  };

  const getMemberName = (userId: string) => {
    const member = members.find(m => m.userId === userId);
    if (!member) return 'Unknown';
    if (member.user.firstName && member.user.lastName) {
      return `${member.user.firstName} ${member.user.lastName}`;
    }
    return member.user.email;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Assignments</span>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" data-testid="button-add-assignment">
              <UserPlus className="h-4 w-4 mr-1" />
              Assign
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Step</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Assign to</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger data-testid="select-assignee">
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
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
                <Label>Due Date (optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="button-select-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  placeholder="Add any instructions or context..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="resize-none"
                  data-testid="input-assignment-notes"
                />
              </div>

              <Button
                className="w-full"
                onClick={handleCreateAssignment}
                disabled={!selectedUser || createAssignmentMutation.isPending}
                data-testid="button-create-assignment"
              >
                {createAssignmentMutation.isPending ? "Assigning..." : "Assign Step"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {stepAssignments.length > 0 ? (
        <div className="space-y-2">
          {stepAssignments.map((assignment) => (
            <div 
              key={assignment.id} 
              className="flex items-center justify-between gap-2 p-2 rounded-md border"
              data-testid={`assignment-${assignment.id}`}
            >
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {assignment.assigneeId.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{getMemberName(assignment.assigneeId)}</p>
                  {assignment.dueDate && (
                    <p className="text-xs text-muted-foreground">
                      Due {format(new Date(assignment.dueDate), "MMM d")}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Badge 
                  variant={assignment.status === 'completed' ? 'default' : 'outline'}
                  className="text-xs"
                >
                  {getStatusIcon(assignment.status)}
                  <span className="ml-1">{assignment.status}</span>
                </Badge>
                {assignment.status !== 'completed' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => updateAssignmentMutation.mutate({ id: assignment.id, status: 'completed' })}
                    data-testid={`button-complete-${assignment.id}`}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                  onClick={() => deleteAssignmentMutation.mutate(assignment.id)}
                  data-testid={`button-delete-${assignment.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">
          No assignments for this step
        </p>
      )}
    </div>
  );
}
