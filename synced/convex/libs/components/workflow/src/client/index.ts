import {
  createFunctionHandle,
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
  FunctionVisibility,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
  RegisteredMutation,
  ReturnValueForOptionalValidator,
} from "convex/server";
import { safeFunctionName } from "./safeFunctionName.js";
import { ObjectType, PropertyValidators, Validator } from "convex/values";
import { api } from "../component/_generated/api.js";
import { OnCompleteArgs, OpaqueIds, UseApi, WorkflowId } from "../types.js";
import { workflowMutation } from "./workflowMutation.js";
import {
  NameOption,
  RetryOption,
  SchedulerOptions,
  WorkpoolOptions,
  WorkpoolRetryOptions,
} from "@convex-dev/workpool";
import { Step } from "../component/schema.js";
export { vWorkflowId } from "../types.js";

export type { WorkflowId };

export type CallbackOptions = {
  /**
   * A mutation to run after the function succeeds, fails, or is canceled.
   * The context type is for your use, feel free to provide a validator for it.
   * e.g.
   * ```ts
   * export const completion = internalMutation({
   *  args: {
   *    workId: workIdValidator,
   *    context: v.any(),
   *    result: resultValidator,
   *  },
   *  handler: async (ctx, args) => {
   *    console.log(args.result, "Got Context back -> ", args.context, Date.now() - args.context);
   *  },
   * });
   * ```
   */
  onComplete?: FunctionReference<
    "mutation",
    FunctionVisibility,
    OnCompleteArgs
  > | null;

  /**
   * A context object to pass to the `onComplete` mutation.
   * Useful for passing data from the enqueue site to the onComplete site.
   */
  context?: unknown;
};

export type WorkflowStep = {
  /**
   * The ID of the workflow currently running.
   */
  workflowId: string;
  /**
   * Run a query with the given name and arguments.
   *
   * @param query - The query to run, like `internal.index.exampleQuery`.
   * @param args - The arguments to the query function.
   * @param opts - Options for scheduling and naming the query.
   */
  runQuery<Query extends FunctionReference<"query", "internal">>(
    query: Query,
    args: FunctionArgs<Query>,
    opts?: NameOption & SchedulerOptions,
  ): Promise<FunctionReturnType<Query>>;

  /**
   * Run a mutation with the given name and arguments.
   *
   * @param mutation - The mutation to run, like `internal.index.exampleMutation`.
   * @param args - The arguments to the mutation function.
   * @param opts - Options for scheduling and naming the mutation.
   */
  runMutation<Mutation extends FunctionReference<"mutation", "internal">>(
    mutation: Mutation,
    args: FunctionArgs<Mutation>,
    opts?: NameOption & SchedulerOptions,
  ): Promise<FunctionReturnType<Mutation>>;

  /**
   * Run an action with the given name and arguments.
   *
   * @param action - The action to run, like `internal.index.exampleAction`.
   * @param args - The arguments to the action function.
   * @param opts - Options for retrying, scheduling and naming the action.
   */
  runAction<Action extends FunctionReference<"action", "internal">>(
    action: Action,
    args: FunctionArgs<Action>,
    opts?: NameOption & SchedulerOptions & RetryOption,
  ): Promise<FunctionReturnType<Action>>;
};

export type WorkflowDefinition<
  ArgsValidator extends PropertyValidators,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ReturnsValidator extends Validator<any, "required", any> | void = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ReturnValue extends ReturnValueForOptionalValidator<ReturnsValidator> = any,
> = {
  args?: ArgsValidator;
  handler: (
    step: WorkflowStep,
    args: ObjectType<ArgsValidator>,
  ) => Promise<ReturnValue>;
  returns?: ReturnsValidator;
  workpoolOptions?: WorkpoolRetryOptions;
};

export type WorkflowStatus =
  | { type: "inProgress"; running: OpaqueIds<Step>[] }
  | { type: "completed" }
  | { type: "canceled" }
  | { type: "failed"; error: string };

export class WorkflowManager {
  constructor(
    public component: UseApi<typeof api>,
    public options?: {
      workpoolOptions: WorkpoolOptions;
    },
  ) {}

  /**
   * Define a new workflow.
   *
   * @param workflow - The workflow definition.
   * @returns The workflow mutation.
   */
  define<
    ArgsValidator extends PropertyValidators,
    ReturnsValidator extends Validator<unknown, "required", string> | void,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ReturnValue extends ReturnValueForOptionalValidator<ReturnsValidator> = any,
  >(
    workflow: WorkflowDefinition<ArgsValidator, ReturnsValidator, ReturnValue>,
  ): RegisteredMutation<"internal", ObjectType<ArgsValidator>, void> {
    return workflowMutation(
      this.component,
      workflow,
      this.options?.workpoolOptions,
    );
  }

  /**
   * Kick off a defined workflow.
   *
   * @param ctx - The Convex context.
   * @param workflow - The workflow to start (e.g. `internal.index.exampleWorkflow`).
   * @param args - The workflow arguments.
   * @returns The workflow ID.
   */
  async start<F extends FunctionReference<"mutation", "internal">>(
    ctx: RunMutationCtx,
    workflow: F,
    args: FunctionArgs<F>,
    options?: CallbackOptions & {
      /**
       * By default, during creation the workflow will be initiated immediately.
       * The benefit is that you catch errors earlier (e.g. passing a bad
       * workflow reference or catch arg validation).
       *
       * With `startAsync` set to true, the workflow will be created but will
       * start asynchronously via the internal workpool.
       * You can use this to queue up a lot of work,
       * or make `start` return faster (you still get a workflowId back).
       * @default false
       */
      startAsync?: boolean;
      /** @deprecated Use `startAsync` instead. */
      validateAsync?: boolean;
    },
  ): Promise<WorkflowId> {
    const handle = await createFunctionHandle(workflow);
    const onComplete = options?.onComplete
      ? {
          fnHandle: await createFunctionHandle(options.onComplete),
          context: options.context,
        }
      : undefined;
    const workflowId = await ctx.runMutation(this.component.workflow.create, {
      workflowName: safeFunctionName(workflow),
      workflowHandle: handle,
      workflowArgs: args,
      maxParallelism: this.options?.workpoolOptions?.maxParallelism,
      onComplete,
      startAsync: options?.startAsync ?? options?.validateAsync,
    });
    return workflowId as unknown as WorkflowId;
  }

  /**
   * Get a workflow's status.
   *
   * @param ctx - The Convex context.
   * @param workflowId - The workflow ID.
   * @returns The workflow status.
   */
  async status(
    ctx: RunQueryCtx,
    workflowId: WorkflowId,
  ): Promise<WorkflowStatus> {
    const { workflow, inProgress } = await ctx.runQuery(
      this.component.workflow.getStatus,
      { workflowId },
    );
    const running = inProgress.map((entry) => entry.step);
    switch (workflow.runResult?.kind) {
      case undefined:
        return { type: "inProgress", running };
      case "canceled":
        return { type: "canceled" };
      case "failed":
        return { type: "failed", error: workflow.runResult.error };
      case "success":
        return { type: "completed" };
    }
  }

  /**
   * Cancel a running workflow.
   *
   * @param ctx - The Convex context.
   * @param workflowId - The workflow ID.
   */
  async cancel(ctx: RunMutationCtx, workflowId: WorkflowId) {
    await ctx.runMutation(this.component.workflow.cancel, {
      workflowId,
    });
  }

  /**
   * Clean up a completed workflow's storage.
   *
   * @param ctx - The Convex context.
   * @param workflowId - The workflow ID.
   * @returns - Whether the workflow's state was cleaned up.
   */
  async cleanup(ctx: RunMutationCtx, workflowId: WorkflowId): Promise<boolean> {
    return await ctx.runMutation(this.component.workflow.cleanup, {
      workflowId,
    });
  }
}

type RunQueryCtx = {
  runQuery: GenericQueryCtx<GenericDataModel>["runQuery"];
};
type RunMutationCtx = {
  runMutation: GenericMutationCtx<GenericDataModel>["runMutation"];
};
