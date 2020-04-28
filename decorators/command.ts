import { INIT_MAP } from './common'

const DEFAULTS: Partial<ICommandDecoratorOpts> = {
  emitsEvent: false,
  resetStates: [],
}

/**
 * Marks the function as command function of the bot.
 *
 * When the user sends a command starting with / (slash) followed by the same
 * name of the function, the function is executed.
 *
 * @export
 * @param {ICommandDecoratorOpts} [opts] Options for the command decorator.
 * @returns Method Decorator
 */
export function command(opts?: ICommandDecoratorOpts) {
  return function <T extends (...args: any[]) => any = (...args: any[]) => any>(target: any, propName: string, descriptor?: TypedPropertyDescriptor<T>) {
    if (typeof opts !== 'object') {
      opts = {
        name: propName,
        ...DEFAULTS
      }
    }
    else {
      opts = {
        name: propName,
        ...DEFAULTS,
        ...opts
      }
    }

    const originalFunction = target[ propName ]

    let initArray = INIT_MAP.get(target)
    if (!initArray) {
      INIT_MAP.set(target, initArray = [])
    }

    initArray.push({
      name: opts.name || propName,
      type: 'command',
      handler: originalFunction,
      opts
    })

    return descriptor
  }
}
