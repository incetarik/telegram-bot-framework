import { IBot } from './bot'
import { _ } from '../translations'

export type InitSettings =
  { name: string, type: 'command', handler(...args: any[]): AsyncGenerator | Promise<any>, opts: ICommandDecoratorOpts }
  | { name: string, type: 'action', handler(...args: any[]): AsyncGenerator | Promise<any>, opts: IActionDecoratorOpts }
  | { name: string, type: 'hears', handler(...args: any[]): AsyncGenerator | Promise<any>, opts: IHearsDecoratorOpts, match: RegExp }
  | { name: string, type: 'help', handler(...args: any[]): AsyncGenerator | Promise<any> }
  | { name: string, type: 'start', handler(...args: any[]): AsyncGenerator | Promise<any> }

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

