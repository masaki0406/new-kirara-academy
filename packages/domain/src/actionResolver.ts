import {
  ActionContext,
  ActionResolver,
  ActionResult,
  PlayerAction,
} from './types';
import {
  applyCollect,
  applyLabActivate,
  applyLensActivate,
  applyMove,
  applyRefresh,
  applyRooting,
  applyPass,
  applyTask,
  applyWill,
  createActionHandler,
  validateCollect,
  validateLabActivate,
  validateLensActivate,
  validateMove,
  validateRefresh,
  validateRooting,
  validatePass,
  validateTask,
  validateWill,
} from './actionHandlers';

export type ActionHandler = (
  action: PlayerAction,
  context: ActionContext,
) => Promise<ActionResult>;

interface ActionResolverDeps {
  handlers: Partial<Record<PlayerAction['actionType'], ActionHandler>>;
}

export class ActionResolverImpl implements ActionResolver {
  constructor(private readonly deps: ActionResolverDeps) {}

  async resolve(action: PlayerAction, context: ActionContext): Promise<ActionResult> {
    const handler = this.deps.handlers[action.actionType];
    if (!handler) {
      return {
        success: false,
        errors: [`Unsupported action type: ${action.actionType}`],
      };
    }

    try {
      return await handler(action, context);
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }
}

export function createDefaultActionResolver(): ActionResolverImpl {
  return new ActionResolverImpl({
    handlers: {
      labActivate: createActionHandler({ validate: validateLabActivate, apply: applyLabActivate }),
      lensActivate: createActionHandler({ validate: validateLensActivate, apply: applyLensActivate }),
      move: createActionHandler({ validate: validateMove, apply: applyMove }),
      refresh: createActionHandler({ validate: validateRefresh, apply: applyRefresh }),
      collect: createActionHandler({ validate: validateCollect, apply: applyCollect }),
      will: createActionHandler({ validate: validateWill, apply: applyWill }),
      task: createActionHandler({ validate: validateTask, apply: applyTask }),
      rooting: createActionHandler({ validate: validateRooting, apply: applyRooting }),
      pass: createActionHandler({ validate: validatePass, apply: applyPass }),
    },
  });
}
