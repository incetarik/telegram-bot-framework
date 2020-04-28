import { INIT_MAP } from './common'

/**
 * Marks the function as start function of the bot.
 * The function will be executed when user sends a `/start` command.
 *
 * @export
 * @returns Method Decorator
 */
export function start() {
  return function <T extends Func = Func>(target: any, propName: string, descriptor?: TypedPropertyDescriptor<T>) {
    let initArray = INIT_MAP.get(target)
    if (!initArray) {
      INIT_MAP.set(target, initArray = [])
    }

    const originalFunction = target[ propName ]

    initArray.push({
      name: propName,
      handler: originalFunction,
      type: 'start',
    })

    return descriptor
  }
}
