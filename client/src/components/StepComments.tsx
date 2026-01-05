import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, Send, Reply, Edit, Check, X, 
  MoreVertical, Trash2 
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

interface StepComment {
  id: number;
  stepId: number;
  guideId: number;
  workspaceId: number;
  authorId: string;
  parentId: number | null;
  content: string;
  isEditProposal: boolean;
  proposedContent: any | null;
  proposalStatus: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StepCommentsProps {
  stepId: number;
  guideId: number;
}

export function StepComments({ stepId, guideId }: StepCommentsProps) {
  const { user } = useAuth();
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState("");

  const { data, isLoading } = useQuery<{ data: StepComment[] }>({
    queryKey: ['/api/steps', stepId, 'comments'],
    enabled: stepId > 0,
  });

  const addCommentMutation = useMutation({
    mutationFn: async (payload: { content: string; parentId?: number }) => {
      return apiRequest('POST', `/api/steps/${stepId}/comments`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/steps', stepId, 'comments'] });
      setNewComment("");
      setReplyingTo(null);
      setReplyContent("");
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      return apiRequest('DELETE', `/api/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/steps', stepId, 'comments'] });
    },
  });

  const handleSubmitComment = () => {
    if (!newComment.trim()) return;
    addCommentMutation.mutate({ content: newComment.trim() });
  };

  const handleSubmitReply = () => {
    if (!replyContent.trim() || !replyingTo) return;
    addCommentMutation.mutate({ 
      content: replyContent.trim(), 
      parentId: replyingTo 
    });
  };

  const comments = data?.data || [];
  const topLevelComments = comments.filter(c => !c.parentId);
  const getReplies = (parentId: number) => comments.filter(c => c.parentId === parentId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        <span className="text-sm font-medium">Comments ({comments.length})</span>
      </div>

      <ScrollArea className="max-h-[300px]">
        <div className="space-y-3 pr-4">
          {topLevelComments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              replies={getReplies(comment.id)}
              currentUserId={user?.id}
              onReply={(id) => setReplyingTo(id)}
              onDelete={(id) => deleteCommentMutation.mutate(id)}
              replyingTo={replyingTo}
              replyContent={replyContent}
              setReplyContent={setReplyContent}
              onSubmitReply={handleSubmitReply}
              isSubmitting={addCommentMutation.isPending}
              onCancelReply={() => {
                setReplyingTo(null);
                setReplyContent("");
              }}
            />
          ))}
          {topLevelComments.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No comments yet. Be the first to comment!
            </p>
          )}
        </div>
      </ScrollArea>

      <div className="flex gap-2">
        <Textarea
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="min-h-[60px] resize-none"
          data-testid="input-new-comment"
        />
        <Button
          size="icon"
          onClick={handleSubmitComment}
          disabled={!newComment.trim() || addCommentMutation.isPending}
          data-testid="button-submit-comment"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface CommentThreadProps {
  comment: StepComment;
  replies: StepComment[];
  currentUserId?: string;
  onReply: (id: number) => void;
  onDelete: (id: number) => void;
  replyingTo: number | null;
  replyContent: string;
  setReplyContent: (content: string) => void;
  onSubmitReply: () => void;
  isSubmitting: boolean;
  onCancelReply: () => void;
}

function CommentThread({
  comment,
  replies,
  currentUserId,
  onReply,
  onDelete,
  replyingTo,
  replyContent,
  setReplyContent,
  onSubmitReply,
  isSubmitting,
  onCancelReply,
}: CommentThreadProps) {
  const isOwner = currentUserId === comment.authorId;

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2 p-2 rounded-md bg-muted/30">
        <Avatar className="h-7 w-7">
          <AvatarFallback className="text-xs">
            {comment.authorId.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">User</span>
              {comment.isEditProposal && (
                <Badge variant="outline" className="text-xs">
                  Edit Proposal
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
              </span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onReply(comment.id)}>
                  <Reply className="h-3 w-3 mr-2" />
                  Reply
                </DropdownMenuItem>
                {isOwner && (
                  <DropdownMenuItem 
                    onClick={() => onDelete(comment.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-3 w-3 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
        </div>
      </div>

      {replies.length > 0 && (
        <div className="ml-6 space-y-2 border-l-2 pl-3">
          {replies.map((reply) => (
            <div key={reply.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/20">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">
                  {reply.authorId.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">User</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm mt-1 whitespace-pre-wrap">{reply.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {replyingTo === comment.id && (
        <div className="ml-6 flex gap-2">
          <Textarea
            placeholder="Write a reply..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            className="min-h-[40px] resize-none text-sm"
            data-testid="input-reply"
          />
          <div className="flex flex-col gap-1">
            <Button
              size="icon"
              className="h-7 w-7"
              onClick={onSubmitReply}
              disabled={!replyContent.trim() || isSubmitting}
              data-testid="button-submit-reply"
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={onCancelReply}
              data-testid="button-cancel-reply"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
