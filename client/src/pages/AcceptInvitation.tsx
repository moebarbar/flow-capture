import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, AlertCircle, Loader2 } from "lucide-react";

interface InvitationDetails {
  id: number;
  email: string;
  role: string;
  status: string;
  workspaceName: string;
  expiresAt: string;
}

export default function AcceptInvitation() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  
  const params = new URLSearchParams(search);
  const token = params.get("token") || "";
  const id = params.get("id") || "";

  const { data: user } = useQuery<{ id: string; email: string } | null>({
    queryKey: ['/api/auth/user'],
  });

  const { data: invitation, isLoading, error } = useQuery<InvitationDetails>({
    queryKey: ['/api/invitations', id],
    queryFn: async () => {
      const res = await fetch(`/api/invitations/${id}?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Invalid invitation");
      }
      return res.json();
    },
    enabled: !!token && !!id,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/invitations/${id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to accept invitation");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Welcome to the team!", description: `You've joined ${data.workspace?.name || 'the workspace'}` });
      navigate(`/workspaces/${data.workspace?.id || ''}`);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to accept invitation", description: err.message, variant: "destructive" });
    },
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/invitations/${id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to decline invitation");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invitation declined" });
      navigate('/');
    },
    onError: (err: Error) => {
      toast({ title: "Failed to decline invitation", description: err.message, variant: "destructive" });
    },
  });

  const isExpired = invitation && new Date(invitation.expiresAt) < new Date();
  const isAlreadyProcessed = invitation && invitation.status !== 'pending';
  const emailMismatch = user && invitation && user.email?.toLowerCase() !== invitation.email.toLowerCase();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 flex flex-col items-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid or has already been used.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button onClick={() => navigate('/')}>Go Home</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Clock className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <CardTitle>Invitation Expired</CardTitle>
            <CardDescription>
              This invitation has expired. Please ask for a new invitation.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button onClick={() => navigate('/')}>Go Home</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (isAlreadyProcessed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle>Invitation Already Processed</CardTitle>
            <CardDescription>
              This invitation has already been {invitation.status}.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button onClick={() => navigate('/')}>Go to Dashboard</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <CardTitle>Sign In Required</CardTitle>
            <CardDescription>
              Please sign in with the email address <strong>{invitation.email}</strong> to accept this invitation to <strong>{invitation.workspaceName}</strong>.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button onClick={() => window.location.href = '/api/login'}>
              Sign In
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (emailMismatch) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <CardTitle>Email Mismatch</CardTitle>
            <CardDescription>
              This invitation was sent to <strong>{invitation.email}</strong>, but you're signed in as <strong>{user.email}</strong>. Please sign in with the correct account.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center gap-2">
            <Button variant="outline" onClick={() => navigate('/')}>Cancel</Button>
            <Button onClick={() => window.location.href = '/api/logout'}>
              Sign Out
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Join {invitation.workspaceName}</CardTitle>
          <CardDescription>
            You've been invited to join as a <strong>{invitation.role}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p>By accepting this invitation, you'll become a member of this workspace and can collaborate on guides and documentation.</p>
        </CardContent>
        <CardFooter className="justify-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => declineMutation.mutate()}
            disabled={declineMutation.isPending || acceptMutation.isPending}
            data-testid="button-decline-invite"
          >
            {declineMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Decline
          </Button>
          <Button 
            onClick={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending || declineMutation.isPending}
            data-testid="button-accept-invite"
          >
            {acceptMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Accept Invitation
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
