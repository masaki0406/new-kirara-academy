"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionResolverImpl = void 0;
exports.createDefaultActionResolver = createDefaultActionResolver;
const actionHandlers_1 = require("./actionHandlers");
class ActionResolverImpl {
    constructor(deps) {
        this.deps = deps;
    }
    async resolve(action, context) {
        const handler = this.deps.handlers[action.actionType];
        if (!handler) {
            return {
                success: false,
                errors: [`Unsupported action type: ${action.actionType}`],
            };
        }
        try {
            return await handler(action, context);
        }
        catch (error) {
            return {
                success: false,
                errors: [error instanceof Error ? error.message : 'Unknown error'],
            };
        }
    }
}
exports.ActionResolverImpl = ActionResolverImpl;
function createDefaultActionResolver() {
    return new ActionResolverImpl({
        handlers: {
            labActivate: (0, actionHandlers_1.createActionHandler)({ validate: actionHandlers_1.validateLabActivate, apply: actionHandlers_1.applyLabActivate }),
            lensActivate: (0, actionHandlers_1.createActionHandler)({ validate: actionHandlers_1.validateLensActivate, apply: actionHandlers_1.applyLensActivate }),
            move: (0, actionHandlers_1.createActionHandler)({ validate: actionHandlers_1.validateMove, apply: actionHandlers_1.applyMove }),
            refresh: (0, actionHandlers_1.createActionHandler)({ validate: actionHandlers_1.validateRefresh, apply: actionHandlers_1.applyRefresh }),
            collect: (0, actionHandlers_1.createActionHandler)({ validate: actionHandlers_1.validateCollect, apply: actionHandlers_1.applyCollect }),
            will: (0, actionHandlers_1.createActionHandler)({ validate: actionHandlers_1.validateWill, apply: actionHandlers_1.applyWill }),
            task: (0, actionHandlers_1.createActionHandler)({ validate: actionHandlers_1.validateTask, apply: actionHandlers_1.applyTask }),
            rooting: (0, actionHandlers_1.createActionHandler)({ validate: actionHandlers_1.validateRooting, apply: actionHandlers_1.applyRooting }),
            pass: (0, actionHandlers_1.createActionHandler)({ validate: actionHandlers_1.validatePass, apply: actionHandlers_1.applyPass }),
        },
    });
}
