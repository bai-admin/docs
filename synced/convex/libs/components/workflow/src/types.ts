import {
  vResultValidator,
  vWorkIdValidator,
  type RunResult,
  type WorkId,
} from "@convex-dev/workpool";
import {
  v,
  type Infer,
  type Validator,
  type Value,
  type VString,
} from "convex/values";

export type WorkflowId = string & { __isWorkflowId: true };
export const vWorkflowId = v.string() as VString<WorkflowId>;

export type EventId<Name extends string = string> = string & {
  __isEventId: true;
  __name: Name;
};
export type VEventId<Name extends string> = VString<EventId<Name>>;
export const vEventId = <Name extends string = string>(_name?: Name) =>
  v.string() as VString<EventId<Name>>;

export type WorkflowStep = {
  workflowId: WorkflowId;
  name: string;
  stepId: string;
  stepNumber: number;

  args: unknown;
  runResult?: RunResult;

  startedAt: number;
  completedAt?: number;
} & (
  | { kind: "function"; workId: WorkId }
  | { kind: "workflow"; nestedWorkflowId: WorkflowId }
  | { kind: "event"; eventId: EventId }
);

export const vWorkflowStep = v.object({
  workflowId: vWorkflowId,
  name: v.string(),
  stepId: v.string(),
  stepNumber: v.number(),

  args: v.any(),
  runResult: v.optional(vResultValidator),

  startedAt: v.number(),
  completedAt: v.optional(v.number()),

  kind: v.union(
    v.literal("function"),
    v.literal("workflow"),
    v.literal("event"),
  ),
  workId: v.optional(vWorkIdValidator),
  nestedWorkflowId: v.optional(vWorkflowId),
  eventId: v.optional(vEventId()),
});
// type assertion to keep us in check
const _: Infer<typeof vWorkflowStep> = {} as WorkflowStep;

export type SchedulerOptions =
  | {
      /**
       * The time (ms since epoch) to run the action at.
       * If not provided, the action will be run as soon as possible.
       * Note: this is advisory only. It may run later.
       */
      runAt?: number;
    }
  | {
      /**
       * The number of milliseconds to run the action after.
       * If not provided, the action will be run as soon as possible.
       * Note: this is advisory only. It may run later.
       */
      runAfter?: number;
    };

export type OnCompleteArgs = {
  /**
   * The ID of the work that completed.
   */
  workflowId: string;
  /**
   * The context object passed when enqueuing the work.
   * Useful for passing data from the enqueue site to the onComplete site.
   */
  context: unknown;
  /**
   * The result of the run that completed.
   */
  result: RunResult;
};

export function vPaginationResult<
  T extends Validator<Value, "required", string>,
>(itemValidator: T) {
  return v.object({
    page: v.array(itemValidator),
    continueCursor: v.string(),
    isDone: v.boolean(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRecommended"),
        v.literal("SplitRequired"),
        v.null(),
      ),
    ),
  });
}
