import { INIT_MAP } from './common'

const DEFAULTS: Partial<IActionDecoratorOpts> = {
  emitsEvent: false
}

/**
 * Marks the function as an action of the bot corresponding to any
 * `callback_data` of any `input$()` message.
 *
 * The function will be executed when the user executes an action due to the,
 * for example, a button provided by a message.
 *
 * @export
 * @param {IActionDecoratorOpts} [opts] Options of the action decorator.
 * @returns Method Decorator
 */
export function action(opts?: IActionDecoratorOpts) {
  return function <T extends (...args: any[]) => any = (...args: any[]) => any>(target: any, propName: string, descriptor?: TypedPropertyDescriptor<T>) {
    if (typeof opts !== 'object') {
      opts = { ...DEFAULTS }
      opts.name = propName
    }
    else {
      opts = {
        ...DEFAULTS,
        ...opts
      }
    }

    if (typeof opts.name !== 'string') {
      opts.name = propName
    }

    const originalFunction = target[ propName ]

    let initArray = INIT_MAP.get(target)
    if (!initArray) {
      INIT_MAP.set(target, initArray = [])
    }

    initArray.push({
      type: 'action',
      handler: originalFunction,
      name: opts.name,
      opts,
    })

    return descriptor
  }
}
