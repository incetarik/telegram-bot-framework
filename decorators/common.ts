import { IBot } from './bot'
import { _ } from '../translations'

export type DecInfo = { name: string, handler(...args: any[]): AsyncGenerator | Promise<any> }
export type HelpInfo = DecInfo & { type: 'help' }
export type StartInfo = DecInfo & { type: 'start' }
export type ActionInfo = DecInfo & { type: 'action', opts: IActionDecoratorOpts }
export type CommandInfo = DecInfo & { type: 'command', opts: ICommandDecoratorOpts }
export type HearsInfo = DecInfo & { type: 'hears', opts: IHearsDecoratorOpts, match: RegExp }

export type InitInfo = CommandInfo | ActionInfo | HelpInfo | StartInfo | HearsInfo

export const SYM_EVENTS = Symbol('@@bot-events')
export const SYM_CONTEXT = Symbol('@@bot-context')
export const SYM_STATE = Symbol('@@bot-state')
export const SYM_ONCE = Symbol('@@once')
export const SYM_PROMISE_REPLACE = Symbol('@@replace')
export const SYM_HEAR_EXEC_COUNTS = Symbol('@@bot-hears-counts')
export const INIT_MAP: WeakMap<IBot, InitInfo[]> = new WeakMap()

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
 * Indicates whether the given object is promise-like or not.
 *
 * @export
 * @template T The type of the promise.
 * @param {*} thing The object to check.
 * @returns {thing is Promise<T>} `true` if the given object is a promise.
 */
export function isPromise<T = any>(thing: any): thing is Promise<T> {
  if (typeof thing !== 'object') { return false }
  if (typeof thing.then !== 'function') { return false }
  if (typeof thing.catch !== 'function') { return false }
  return true
}
