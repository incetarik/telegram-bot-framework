import { ContextMessageUpdate } from 'telegraf'

import { WaitingStates } from '../common'
import {
  executer, INIT_MAP, SYM_COMMANDS, SYM_EVENTS, SYM_STATE
} from './common'

export function command(opts?: ICommandDecoratorOpts) {
  return function <T extends (...args: any[]) => any = (...args: any[]) => any>(target: any, propName: string, descriptor?: TypedPropertyDescriptor<T>) {
    const {
      name = propName,
      emitsEvent = false,
      resetStates = [],
    } = (opts || {});

    const originalFunction = target[ propName ]

    function commandContent(this: any, ctx: ContextMessageUpdate) {
      if (emitsEvent) {
        this[ SYM_EVENTS ].next({
          name: `command.call.${name}`,
          type: 'i'
        })
      }

      if (ctx.from) {
        WaitingStates[ 'cancelWaiting' ](ctx.from.id)
      }

      const state = this[ SYM_STATE ] as Dictionary<{ value: any, props: IBotStateSettings }>
      resetStates.forEach(value => {
        if (typeof value === 'string') {
          if (!(value in state)) { return }

          //@ts-ignore
          state[ value ].value = state[ value ].props._propDefault

          //@ts-ignore
          state[ value ].props[ '_reset' ]?.()
        }
        else if (Array.isArray(value)) {
          const [ key, defaultValue ] = value
          if (!(key in state)) { return }

          //@ts-ignore
          state[ key ].props[ '_reset' ]?.()
          state[ key ].value = defaultValue
        }
      })

      const fun = executer(this, originalFunction, ctx, opts as any)
      this[ SYM_COMMANDS ][ propName ] = fun

      return fun
    }

    let initArray = INIT_MAP.get(target)
    if (!initArray) {
      INIT_MAP.set(target, initArray = [])
    }

    initArray.push({ name, type: 'command', value: commandContent })

    Object.defineProperty(target, propName, {
      get() {
        return this[ SYM_COMMANDS ][ propName ]
      },
    })

    return descriptor
  }
}
