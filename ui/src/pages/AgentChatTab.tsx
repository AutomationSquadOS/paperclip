import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import type { Agent, IssueWorkMode } from "@paperclipai/shared";
import { agentsApi, type AgentChatConversation } from "../api/agents";
import { issuesApi } from "../api/issues";
import { activityApi } from "../api/activity";
import { heartbeatsApi, type ActiveRunForIssue, type LiveRunForIssue } from "../api/heartbeats";
import { authApi } from "../api/auth";
import { accessApi } from "../api/access";
import { instanceSettingsApi } from "../api/instanceSettings";
import { queryKeys } from "../lib/queryKeys";
import { keepPreviousDataForSameQueryTail } from "../lib/query-placeholder-data";
import { resolveIssueActiveRun } from "../lib/issueActiveRun";
import {
  buildCompanyUserLabelMap,
  buildCompanyUserProfileMap,
} from "../lib/company-members";
import { IssueChatThread } from "../components/IssueChatThread";
import { ChatComposer } from "../components/ChatComposer";
import { InlineBanner } from "../components/InlineBanner";
import { AgentIcon } from "../components/AgentIconPicker";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ExternalLink, MessageSquare } from "lucide-react";

function composerDisabledReasonForBlock(
  blockReason: AgentChatConversation["blockReason"],
): string | null {
  switch (blockReason) {
    case "pending_approval":
      return "This agent is pending board approval and cannot be messaged yet.";
    case "paused":
      return "This agent is paused. Resume it before chatting.";
    case "budget_paused":
      return "This agent is paused for budget. Adjust the budget or resume before chatting.";
    case "terminated":
      return "This agent is terminated and cannot be messaged.";
    case "invalid_org_chain":
      return "Repair this agent's reporting chain before chatting.";
    case "error":
      return null;
    default:
      return null;
  }
}

function ChatRoleLegend({ agentName }: { agentName: string }) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-(length:--text-micro) text-muted-foreground"
      aria-label="Message roles"
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block size-2.5 shrink-0 rounded-sm bg-(--liveness-blue)"
          aria-hidden
        />
        <span>
          <span className="font-medium text-foreground">You</span>
          <span className="text-muted-foreground"> · right</span>
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block size-2.5 shrink-0 rounded-sm border border-border bg-card"
          aria-hidden
        />
        <span>
          <span className="font-medium text-foreground">{agentName}</span>
          <span className="text-muted-foreground"> · left</span>
        </span>
      </span>
    </div>
  );
}

export function AgentChatTab({
  agent,
  companyId,
}: {
  agent: Agent;
  companyId: string;
}) {
  const queryClient = useQueryClient();
  const [bootstrapDraft, setBootstrapDraft] = useState("");
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const chatQuery = useQuery({
    queryKey: queryKeys.agents.chat(agent.id),
    queryFn: () => agentsApi.getChat(agent.id, companyId),
  });

  const issue = chatQuery.data?.issue ?? null;
  const issueId = issue?.id ?? null;
  const blockReason = chatQuery.data?.blockReason ?? null;
  const hardDisabledReason = composerDisabledReasonForBlock(blockReason);

  const { data: session } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
  });
  const currentUserId = session?.user?.id ?? session?.session?.userId ?? null;

  const { data: companyMembers } = useQuery({
    queryKey: queryKeys.access.companyMembers(companyId),
    queryFn: () => accessApi.listUserDirectory(companyId),
    enabled: Boolean(companyId),
  });

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled: Boolean(companyId),
  });

  const { data: comments = [] } = useQuery({
    queryKey: issueId ? queryKeys.issues.commentsList(issueId) : ["agent-chat", "comments", "none"],
    queryFn: () => issuesApi.listComments(issueId!, { order: "asc", limit: 200 }),
    enabled: Boolean(issueId),
    placeholderData: issueId ? keepPreviousDataForSameQueryTail(issueId) : undefined,
  });

  const { data: liveRuns = [] } = useQuery({
    queryKey: issueId ? queryKeys.issues.liveRuns(issueId) : ["agent-chat", "live-runs", "none"],
    queryFn: () => heartbeatsApi.liveRunsForIssue(issueId!),
    enabled: Boolean(issueId),
    refetchInterval: 3000,
    placeholderData: issueId ? keepPreviousDataForSameQueryTail<LiveRunForIssue[]>(issueId) : undefined,
  });

  const { data: activeRun = null } = useQuery({
    queryKey: issueId ? queryKeys.issues.activeRun(issueId) : ["agent-chat", "active-run", "none"],
    queryFn: () => heartbeatsApi.activeRunForIssue(issueId!),
    enabled: Boolean(issueId) && (Boolean(issue?.executionRunId) || issue?.status === "in_progress" || liveRuns.length === 0),
    refetchInterval: liveRuns.length > 0 ? false : 3000,
    placeholderData: issueId
      ? keepPreviousDataForSameQueryTail<ActiveRunForIssue | null>(issueId)
      : undefined,
  });

  const resolvedActiveRun = useMemo(
    () => (issue ? resolveIssueActiveRun(issue, activeRun) : null),
    [activeRun, issue],
  );

  const { data: linkedRuns = [] } = useQuery({
    queryKey: issueId ? queryKeys.issues.runs(issueId) : ["agent-chat", "runs", "none"],
    queryFn: () => activityApi.runsForIssue(issueId!),
    enabled: Boolean(issueId),
    refetchInterval: liveRuns.length > 0 || resolvedActiveRun ? 5000 : false,
  });

  const { data: interactions = [] } = useQuery({
    queryKey: issueId ? queryKeys.issues.interactions(issueId) : ["agent-chat", "interactions", "none"],
    queryFn: () => issuesApi.listInteractions(issueId!),
    enabled: Boolean(issueId),
  });

  const { data: feedbackVotes = [] } = useQuery({
    queryKey: issueId ? queryKeys.issues.feedbackVotes(issueId) : ["agent-chat", "feedback", "none"],
    queryFn: () => issuesApi.listFeedbackVotes(issueId!),
    enabled: Boolean(issueId),
  });

  const { data: instanceGeneralSettings } = useQuery({
    queryKey: queryKeys.instance.generalSettings,
    queryFn: () => instanceSettingsApi.getGeneral(),
    enabled: Boolean(issueId),
    retry: false,
  });

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const row of agents) map.set(row.id, row);
    map.set(agent.id, agent);
    return map;
  }, [agent, agents]);

  const userProfileMap = useMemo(
    () => buildCompanyUserProfileMap(companyMembers?.users),
    [companyMembers?.users],
  );
  const userLabelMap = useMemo(
    () => buildCompanyUserLabelMap(companyMembers?.users),
    [companyMembers?.users],
  );

  const timelineRuns = useMemo(() => {
    const liveIds = new Set(liveRuns.map((run) => run.id));
    if (resolvedActiveRun) liveIds.add(resolvedActiveRun.id);
    return linkedRuns
      .filter((run) => !liveIds.has(run.runId))
      .map((run) => ({
        ...run,
        adapterType: run.adapterType,
        hasStoredOutput: (run.logBytes ?? 0) > 0,
      }));
  }, [linkedRuns, liveRuns, resolvedActiveRun]);

  const invalidateChat = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.agents.chat(agent.id) });
    if (!issueId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.detail(issueId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.commentsList(issueId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.liveRuns(issueId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.activeRun(issueId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.runs(issueId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.interactions(issueId) }),
    ]);
  }, [agent.id, issueId, queryClient]);

  const ensureChat = useMutation({
    mutationFn: () => agentsApi.ensureChat(agent.id, companyId),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.agents.chat(agent.id), result);
    },
  });

  const sendBootstrap = useMutation({
    mutationFn: async (body: string) => {
      const ensured = await agentsApi.ensureChat(agent.id, companyId);
      queryClient.setQueryData(queryKeys.agents.chat(agent.id), ensured);
      await issuesApi.addComment(ensured.issue.id, body);
      return ensured.issue;
    },
    onSuccess: async () => {
      setBootstrapDraft("");
      setBootstrapError(null);
      await invalidateChat();
    },
    onError: (err) => {
      setBootstrapError(err instanceof Error ? err.message : "Failed to send message");
    },
  });

  const handleAdd = useCallback(async (body: string, reopen?: boolean) => {
    if (!issueId) return;
    await issuesApi.addComment(issueId, body, reopen);
    await invalidateChat();
  }, [invalidateChat, issueId]);

  const handleWorkModeChange = useCallback(async (workMode: IssueWorkMode) => {
    if (!issueId) return;
    await issuesApi.update(issueId, { workMode });
    await invalidateChat();
  }, [invalidateChat, issueId]);

  const handleVote = useCallback(async (
    commentId: string,
    vote: "up" | "down",
    options?: { allowSharing?: boolean; reason?: string },
  ) => {
    if (!issueId) return;
    await issuesApi.upsertFeedbackVote(issueId, {
      targetType: "issue_comment",
      targetId: commentId,
      vote,
      reason: options?.reason,
      allowSharing: options?.allowSharing,
    });
    await queryClient.invalidateQueries({ queryKey: queryKeys.issues.feedbackVotes(issueId) });
  }, [issueId, queryClient]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!issueId) throw new Error("Start the conversation before attaching files.");
    const attachment = await issuesApi.uploadAttachment(companyId, issueId, file);
    return attachment.contentPath;
  }, [companyId, issueId]);

  const handleAttachImage = useCallback(async (file: File) => {
    if (!issueId) throw new Error("Start the conversation before attaching files.");
    return issuesApi.uploadAttachment(companyId, issueId, file);
  }, [companyId, issueId]);

  if (chatQuery.isLoading) {
    return (
      <div className="space-y-3 py-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-(--sz-calc-9) w-full" />
      </div>
    );
  }

  if (chatQuery.isError) {
    return (
      <InlineBanner tone="danger" title="Could not load agent chat">
        {chatQuery.error instanceof Error ? chatQuery.error.message : "Unknown error"}
      </InlineBanner>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="agent-chat-tab">
      {blockReason === "error" ? (
        <InlineBanner tone="warning" title="Agent is in an error state">
          You can still send a message. Clear the error from the agent dashboard if runs keep failing.
        </InlineBanner>
      ) : null}

      <div
        className={cn(
          "flex h-(--sz-calc-9) min-h-(--sz-calc-36) flex-col overflow-hidden rounded-xl border border-border bg-background",
        )}
      >
        {/* Chat header — mirrors BoardChat conference-room chrome */}
        <div className="relative flex shrink-0 items-start justify-between gap-3 px-4 py-3">
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-border"
            aria-hidden
          />
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
              <AgentIcon icon={agent.icon} className="h-5 w-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <h2 className="truncate text-sm font-semibold text-foreground">
                Chat with {agent.name}
              </h2>
              <p className="text-xs text-muted-foreground">
                Your messages wake this agent on a standing conversation issue.
              </p>
              <ChatRoleLegend agentName={agent.name} />
            </div>
          </div>
          {issue ? (
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link to={`/issues/${issue.identifier ?? issue.id}`}>
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                {issue.identifier ?? "Open issue"}
              </Link>
            </Button>
          ) : null}
        </div>

        {issue ? (
          <div
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-muted/15"
            data-testid="agent-chat-scroll"
          >
            <div className="flex min-h-full flex-col px-1 pt-3 sm:px-2">
              <IssueChatThread
                comments={comments}
                interactions={interactions}
                feedbackVotes={feedbackVotes}
                feedbackDataSharingPreference={instanceGeneralSettings?.feedbackDataSharingPreference ?? "prompt"}
                linkedRuns={timelineRuns}
                liveRuns={liveRuns}
                activeRun={resolvedActiveRun}
                issueId={issue.id}
                blockedBy={issue.blockedBy ?? []}
                blockerAttention={issue.blockerAttention ?? null}
                successfulRunHandoff={issue.successfulRunHandoff ?? null}
                scheduledRetry={issue.scheduledRetry ?? null}
                recoveryAction={issue.activeRecoveryAction ?? null}
                companyId={issue.companyId}
                projectId={issue.projectId}
                issueStatus={issue.status}
                agentMap={agentMap}
                currentUserId={currentUserId}
                userLabelMap={userLabelMap}
                userProfileMap={userProfileMap}
                draftKey={`paperclip:agent-chat-draft:${issue.id}`}
                autoScrollToLatestOnInitialLoad
                emptyMessage={`No messages yet. Write below to wake ${agent.name}.`}
                composerDisabledReason={hardDisabledReason}
                composerHint={
                  hardDisabledReason
                    ? null
                    : `Your reply · wakes ${agent.name}. Ask them to create or link tasks when useful.`
                }
                onAdd={handleAdd}
                onVote={handleVote}
                imageUploadHandler={handleImageUpload}
                onAttachImage={handleAttachImage}
                onDeleteComment={async (commentId) => {
                  await issuesApi.deleteComment(issue.id, commentId);
                  await queryClient.invalidateQueries({ queryKey: queryKeys.issues.commentsList(issue.id) });
                }}
                onInterruptQueued={async (runId) => {
                  await heartbeatsApi.cancel(runId);
                  await invalidateChat();
                }}
                onCancelQueued={async (commentId) => {
                  await issuesApi.cancelComment(issue.id, commentId);
                  await invalidateChat();
                }}
                issueWorkMode={issue.workMode ?? "standard"}
                onWorkModeChange={handleWorkModeChange}
                assigneeUserId={issue.assigneeUserId ?? null}
                variant="embedded"
                presentation="conversation"
              />
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col bg-muted/15">
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground">
                <MessageSquare className="h-6 w-6 opacity-70" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Start a conversation</p>
                <p className="mx-auto max-w-md text-xs text-muted-foreground">
                  The first message creates a hidden conversation issue assigned to{" "}
                  <span className="text-foreground">{agent.name}</span>, labeled{" "}
                  <code className="text-foreground">agent-chat</code>, then wakes the agent.
                </p>
              </div>
              <ChatRoleLegend agentName={agent.name} />
              {!hardDisabledReason ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={ensureChat.isPending}
                  onClick={() => ensureChat.mutate()}
                >
                  {ensureChat.isPending ? "Preparing…" : "Prepare conversation"}
                </Button>
              ) : null}
            </div>

            <div className="shrink-0 space-y-2 border-t border-border/60 bg-gradient-to-t from-background via-background to-background/90 px-4 pb-4 pt-3">
              <div className="flex items-center justify-between gap-2 px-0.5">
                <span className="text-(length:--text-micro) font-medium uppercase tracking-(--tracking-eyebrow) text-muted-foreground">
                  Your message
                </span>
                <span className="text-(length:--text-micro) text-muted-foreground/80">
                  You right · agent left
                </span>
              </div>
              {bootstrapError ? (
                <p className="text-sm text-destructive">{bootstrapError}</p>
              ) : null}
              {hardDisabledReason ? (
                <p className="rounded-md border border-amber-300/70 bg-amber-50/80 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                  {hardDisabledReason}
                </p>
              ) : (
                <ChatComposer
                  value={bootstrapDraft}
                  onChange={setBootstrapDraft}
                  onSubmit={() => {
                    const body = bootstrapDraft.trim();
                    if (!body || sendBootstrap.isPending) return;
                    sendBootstrap.mutate(body);
                  }}
                  placeholder={`Message ${agent.name}…`}
                  disabled={sendBootstrap.isPending}
                  submitting={sendBootstrap.isPending}
                  submitKey="mod-enter"
                  sendLabel="Send message"
                  surface="translucent"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
