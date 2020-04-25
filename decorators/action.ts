import { ContextMessageUpdate } from 'telegraf'

import { executer, INIT_MAP, SYM_ACTIONS, SYM_EVENTS } from './common'

export function action(opts?: IActionDecoratorOpts) {
  return function <T extends Function = Function>(target: any, propName: string, descriptor?: TypedPropertyDescriptor<T>) {
    const {
      name = propName,
      emitsEvent = false,
    } = (opts || {});

    const originalFunction = target[ propName ]
    function actionContent(this: any, ctx: ContextMessageUpdate) {
      if (emitsEvent) {
        this[ SYM_EVENTS ].next({
          name: `action.call.${name}`,
          type: 'i'
        })
      }

      const fun = executer(this, originalFunction, ctx, opts as any)
      this[ SYM_ACTIONS ][ propName ] = fun
      return fun
    }

    let initArray = INIT_MAP.get(target)
    if (!initArray) {
      INIT_MAP.set(target, initArray = [])
    }

    initArray.push({ type: 'action', value: actionContent, name })

    Object.defineProperty(target, propName, {
      get() {
        return this[ SYM_ACTIONS ][ propName ]
      }
    })

    return descriptor
  }
}
