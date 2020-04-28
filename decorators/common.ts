import { ContextMessageUpdate } from 'telegraf'

import { IBot } from './bot'
import { _ } from '../translations'

export type InitSettings =
  { name: string, type: 'command', handler(...args: any[]): AsyncGenerator | Promise<any>, opts: ICommandDecoratorOpts }
  | { name: string, type: 'action', handler(...args: any[]): AsyncGenerator | Promise<any>, opts: IActionDecoratorOpts }
  | { name: string, type: 'hears', handler(...args: any[]): AsyncGenerator | Promise<any>, opts: IHearsDecoratorOpts, match: RegExp }

export const SYM_EVENTS = Symbol('@@bot-events')
export const SYM_CONTEXT = Symbol('@@bot-caller')
export const SYM_STATE = Symbol('@@bot-state')
export const SYM_PROMISE_REPLACE = Symbol('@@replace')
export const SYM_HEAR_EXEC_COUNTS = Symbol('@@bot-hears-counts')
export const INIT_MAP: WeakMap<IBot, InitSettings[]> = new WeakMap()

/**
 * Indicates whether the given object is generator-like or not.
 *
 * @export
 * @param {*} thing The object to check.
 * @returns {thing is AsyncGenerator} `true` if the given object is generator.
 */
export function isGenerator(thing: any): thing is AsyncGenerator {
  if (typeof thing !== 'object') { return false }
  if (typeof thing.next !== 'function') { return false }
  if (typeof thing.return !== 'function') { return false }
  if (typeof thing.throw !== 'function') { return false }
  return true
}

/**
 * The main executer wrapper for a function given with the context and the
 * instance of the class.
 *
 * This function wraps the original function with a generator and executes
 * the generator until its end.
 *
 * - If the function was also a generator returning function, the generator
 * returned will be iterated.
 * - If the function was an async function, then the value is returned.
 * - If the function is sync function, then the value is returned.
 *
 * The function is invoked with the class instance, so `this` keyword is valid.
 * Likewise, the function will have `this.context` according to the last
 * message update.
 *
 * The inner generator will be cancelled if the message from user is starting
 * with `/` (slash) probably indicating a command.
 *
 * @export
 * @template T The type of the function.
 * @param {*} instance The instance of the class containing the function.
 * @param {T} fun The function to iterate its generator or return its value.
 * @param {ContextMessageUpdate} context The last message context.
 * @param {*} [extra] Extra information for the executer.
 * @returns A generator function.
 */
export function executer<T extends Function = Function>(instance: any, fun: T, context: ContextMessageUpdate, extra?: { timeout?: number, timeoutMessage?: string, cancelIfUserIsWaited?: boolean }) {
  let timeout: number
  let timeoutMessage: string
  let timeoutId: any

  return async function* (...args: any[]) {
    instance.context = context
    instance[ SYM_CONTEXT ] = context

    const result = await fun.apply(instance, args) as Promise<any> | AsyncGenerator
    if (result instanceof Error) {
      context.reply(_(timeoutMessage, context.from?.language_code || 'en', timeoutMessage))
      return result
    }

    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    if (isGenerator(result)) {
      let nextValue
      let willContinue = true

      if (extra) {
        if (extra.timeout) {
          timeout = extra.timeout
          timeoutMessage = extra.timeoutMessage ?? 'Timed out'

          timeoutId = setTimeout(() => {
            result.return(new Error(timeoutMessage))
            context.reply(_(timeoutMessage, context.from?.language_code || 'en', timeoutMessage))
          }, timeout);
        }
      }

      do {
        const iteratorResult: IteratorResult<any> = await result.next(nextValue)

        if (iteratorResult.done) {
          willContinue = false
          return iteratorResult.value
        }
        else {
          nextValue = yield iteratorResult.value
          if (typeof nextValue === 'string') {
            if (nextValue.startsWith('/')) {
              return
            }
          }
        }

        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = undefined
        }
      }
      while (willContinue)
    }
    else {
      return result
    }
  }
}
