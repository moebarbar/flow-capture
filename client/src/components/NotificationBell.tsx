import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Bell, Check, CheckCheck, MessageSquare, ClipboardList, FileCheck, UserPlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface Notification {
  id: number;
  userId: string;
  type: string;
  title: string;
  message: string;
  workspaceId: number | null;
  guideId: number | null;
  stepId: number | null;
  referenceId: number | null;
  actorId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);

  const { data, isError } = useQuery<{ data: Notification[]; unreadCount: number }>({
    queryKey: ['/api/notifications'],
    refetchInterval: 30000,
    retry: 1,
  });

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      await apiRequest('POST', `/api/notifications/${notificationId}/read`);
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['/api/notifications'] });
      const previousData = queryClient.getQueryData<{ data: Notification[]; unreadCount: number }>(['/api/notifications']);
      if (previousData) {
        queryClient.setQueryData(['/api/notifications'], {
          ...previousData,
          data: previousData.data.map(n => 
            n.id === notificationId ? { ...n, isRead: true } : n
          ),
          unreadCount: Math.max(0, previousData.unreadCount - 1),
        });
      }
      return { previousData };
    },
    onError: (err, notificationId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['/api/notifications'], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/notifications/read-all');
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['/api/notifications'] });
      const previousData = queryClient.getQueryData<{ data: Notification[]; unreadCount: number }>(['/api/notifications']);
      if (previousData) {
        queryClient.setQueryData(['/api/notifications'], {
          ...previousData,
          data: previousData.data.map(n => ({ ...n, isRead: true })),
          unreadCount: 0,
        });
      }
      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['/api/notifications'], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  if (isError) {
    return (
      <Button variant="ghost" size="icon" disabled data-testid="button-notifications">
        <Bell className="h-5 w-5 text-muted-foreground" />
      </Button>
    );
  }

  const unreadCount = data?.unreadCount || 0;
  const notifications = data?.data || [];

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'comment_added':
      case 'comment_reply':
      case 'comment_mention':
        return <MessageSquare className="h-4 w-4" />;
      case 'assignment_created':
      case 'assignment_updated':
      case 'assignment_completed':
        return <ClipboardList className="h-4 w-4" />;
      case 'approval_requested':
      case 'approval_approved':
      case 'approval_rejected':
      case 'approval_revision':
        return <FileCheck className="h-4 w-4" />;
      case 'workspace_invitation':
        return <UserPlus className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              variant="destructive"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between gap-2 p-3 border-b">
          <h4 className="font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 cursor-pointer hover-elevate ${!notification.isRead ? 'bg-muted/50' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                  data-testid={`notification-${notification.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`rounded-full p-2 ${!notification.isRead ? 'bg-primary/10 text-primary' : 'bg-muted'}`}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{notification.title}</p>
                        {!notification.isRead && (
                          <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
