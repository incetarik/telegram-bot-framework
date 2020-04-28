import { INIT_MAP } from './common'

/**
 * Marks the function as help function of the bot.
 * The function will be executed when user sends a `/help` command.
 *
 * **NOTE**: You may just have a function named `help` in your class to make
 * it the function will respond to the `/help` command. Use this decorator to
 * mark another function as `/help`.
 *
 * @export
 * @returns Method Decorator
 */
export function help() {
  return function <T extends Func = Func>(target: any, propName: string, descriptor?: TypedPropertyDescriptor<T>) {
    let initArray = INIT_MAP.get(target)
    if (!initArray) {
      INIT_MAP.set(target, initArray = [])
    }

    const originalFunction = target[ propName ]

    initArray.push({
      name: propName,
      handler: originalFunction,
      type: 'help',
    })

    return descriptor
  }
}
