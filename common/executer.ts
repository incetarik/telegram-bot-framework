import { compile as compileTemplate } from 'handlebars'
import { ContextMessageUpdate } from 'telegraf'
import { IncomingMessage, Message } from 'telegraf/typings/telegram-types'

import { IBot } from '../decorators'
import {
  InitSettings, isGenerator, SYM_CONTEXT, SYM_EVENTS, SYM_HEAR_EXEC_COUNTS,
  SYM_ONCE, SYM_PROMISE_REPLACE, SYM_STATE
} from '../decorators/common'
import { _ } from '../translations'
import { IInputOpts, isInputOptions } from './input-opts'
import { INotificationInfo, isNotificationInfo } from './notify-users'
import { IReplyMessage } from './reply-message'
import { WaitingStates } from './waiting-states'

type IIteratorOpts = {
  timeout?: number,
  timeoutMessage?: string,
  name?: string
  type?: 'action' | 'command' | 'hears',
  parameters?: any[]
}

class Executer {
  private askedInputInCommand: WeakMap<any, boolean> = new WeakMap()
  private executingCommand: WeakMap<any, { genOrPromise: AsyncGenerator | Promise<any>, initializer: InitSettings }> = new WeakMap()
  private executingHear: WeakMap<any, boolean> = new WeakMap()
  private onceExecutions: WeakMap<any, any> = new WeakMap()

  async fireGeneric(instance: IBot, ctx: ContextMessageUpdate, initializer: InitSettings) {
    const genOrPromise = initializer.handler.call(instance, ctx)

    if (isGenerator(genOrPromise)) {
      return await this.iterate(instance, ctx, genOrPromise)
    }
    else {
      return await genOrPromise
    }
  }

  async fireOnCommand(instance: IBot, ctx: ContextMessageUpdate, initializer: InitSettings) {
    if (!this.canFire(instance, ctx, initializer)) {
      return
    }

    const {
      onlyFor,
      unauthorizedExecHandlerName = 'onUnauthorizedCommand'
    } = (initializer as any).opts

    if (onlyFor) {
      let { username = '', id } = ctx.from!
      if (username.startsWith('@')) {
        username = username.slice(1)
      }

      let isUnauthorized = false
      if (typeof onlyFor === 'string' && username !== onlyFor) {
        isUnauthorized = true
      }
      else if (typeof onlyFor === 'number' && id !== onlyFor) {
        isUnauthorized = true
      }
      else if (typeof onlyFor === 'function') {
        const result = await onlyFor(id, username)
        isUnauthorized = !result
      }
      else if (Array.isArray(onlyFor)) {
        let matched = false
        for (const cond of onlyFor) {
          if (typeof cond === 'string' && cond === username) {
            matched = true
            break
          }
          else if (typeof cond === 'number' && cond === id) {
            matched = true
            break
          }
        }

        isUnauthorized = !matched
      }

      if (isUnauthorized) {
        //@ts-ignore
        const handler = instance[ unauthorizedExecHandlerName ] as Func | undefined

        if (handler) {
          await this.iterate(instance, ctx, handler, {
            parameters: [ initializer.name, id, username, ctx ],
            name: initializer.name,
            type: initializer.type as any
          })
        }

        return
      }
    }

    if (this.askedInputInCommand.get(instance)) {
      return
    }

    //@ts-ignore
    const { handler, opts } = initializer

    const {
      emitsEvent,
      resetStates,
      timeout,
      timeoutMessage = 'Timed out',
      name
    } = opts as any

    const previousCommand = this.executingCommand.get(instance)
    if (previousCommand) {
      if (emitsEvent) {
        this.emit(instance, 'command.cancel', 'i', name)
      }

      WaitingStates[ 'cancelWaiting' ](ctx.from?.id)
    }

    //@ts-ignore
    const state = instance[ SYM_STATE ] as Dictionary<{ value: any, props: IBotStateSettings }>
    for (let i = 0, limit = resetStates!.length; i < limit; ++i) {
      const rs = resetStates![ i ]
      if (typeof rs === 'string') {
        if (!(rs in state)) { continue }

        //@ts-ignore
        state[ rs ].value = state[ rs ].props._propDefault

        //@ts-ignore
        state[ rs ].props[ '_reset' ]?.()
      }
      else if (Array.isArray(rs)) {
        const [ key, defaultValue ] = rs
        if (!(key in state)) { continue }

        //@ts-ignore
        state[ key ].props[ '_reset' ]?.()
        state[ key ].value = defaultValue
      }
    }

    const genOrPromise = handler.call(instance)
    if (emitsEvent) {
      this.emit(instance, 'command.call', 'i', name)
    }

    this.executingCommand.set(instance, { genOrPromise, initializer })

    //@ts-ignore
    instance[ SYM_CONTEXT ] = ctx

    const generator = this.wrapper(instance, handler, ctx, {
      timeout,
      timeoutMessage,
      name: initializer.name,
      type: 'command',
    })()

    let returnValue: any
    let nextValue: any

    while (true) {
      // NOTE: We may also get a function to execute on the instance
      // to provide first value to be passed to the generator, so the
      // developer may get that value just by doing `const value = yield`

      const { value, done } = await generator.next(nextValue)
      if (done) {
        returnValue = value
        break
      }

      nextValue = await generator.next(nextValue)
    }

    this.askedInputInCommand.delete(instance)
    this.executingCommand.delete(instance)
    return returnValue
  }

  async fireOnAction(instance: IBot, ctx: ContextMessageUpdate, initializer: InitSettings) {
    if (!this.canFire(instance, ctx, initializer)) {
      return
    }

    const command = this.executingCommand.get(instance)

    //@ts-ignore
    const genOrPromise = initializer.handler.call(instance, ctx, command?.initializer?.name)
    let value: any
    if (isGenerator(genOrPromise)) {
      value = await this.iterate(instance, ctx, genOrPromise)
    }
    else {
      value = await genOrPromise
    }

    return value
  }

  async fireOnHears(instance: IBot, ctx: ContextMessageUpdate, initializer: InitSettings) {
    if (!this.canFire(instance, ctx, initializer)) {
      return
    }

    //@ts-ignore
    const { opts, handler } = initializer
    //@ts-ignore
    const { executeDuringCommand, othersMayHear } = opts

    if (!executeDuringCommand && this.askedInputInCommand.get(instance)) { return }

    const { message } = ctx
    if (!message) { return }

    const { text } = message
    if (!text) { return }

    if (this.executingHear.has(instance)) {
      if (!othersMayHear) {
        return
      }
    }

    //@ts-ignore
    const executionCounts: Dictionary<number> = instance[ SYM_HEAR_EXEC_COUNTS ]
    const executionCount = executionCounts[ initializer.name ]

    if (isFinite(executionCount)) {
      if (executionCount > 0) {
        //@ts-ignore
        executionCounts[ initializer.name ] = executionCount - 1
      }
      else {
        return
      }
    }

    this.executingHear.set(instance, true)

    //@ts-ignore
    const { keepMatchResults, emitsEvent, match } = opts

    //@ts-ignore
    instance[ SYM_CONTEXT ] = ctx

    //@ts-ignore
    const matches = text.match(initializer.match)!
    _resetMatchArray(instance, matches)

    //@ts-ignore
    instance.lastMatch = matches

    const parameters = matches.slice(1)
    parameters.push(matches[ 0 ])

    const genOrPromise = handler.apply(instance, parameters)

    if (emitsEvent) {
      this.emit(instance, 'hears.call', 'i', match)
    }

    let value: any

    if (isGenerator(genOrPromise)) {
      value = await this.iterate(instance, ctx, genOrPromise)
    }
    else {
      value = await genOrPromise
    }

    if (!keepMatchResults) {
      _resetMatch(instance,
        void 0,
        void 0,
        void 0,
        void 0,
        void 0,
        void 0,
        void 0,
        void 0,
        void 0,
        void 0
      )
    }

    if (!WaitingStates.isWaitingFor(ctx.from!.id!)) {
      this.executingHear.delete(instance)
    }

    return value
  }

  private wrapper(instance: IBot, func: Func, ctx: ContextMessageUpdate, options: IIteratorOpts = {}) {
    const that = this
    let timeoutId: any

    return async function* (...args: any[]) {
      //@ts-ignore
      instance[ SYM_CONTEXT ] = ctx

      const result = await func.apply(instance, args)
      if (result instanceof Error) {
        ctx.reply(_(result.message, ctx.from?.language_code || 'en', result.message))
        return result
      }

      if (isGenerator(result)) {
        let { timeout, timeoutMessage = 'Timed out' } = options
        if (timeoutId) { clearTimeout(timeoutId) }

        if (timeout) {
          timeoutId = setTimeout(() => {
            result.return(new Error(timeoutMessage))
            ctx.reply(_(timeoutMessage, ctx.from?.language_code || 'en', timeoutMessage))
          }, timeout)
        }

        const returnValue = await that.iterate(instance, ctx, result, options)

        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = undefined
        }

        return returnValue
      }
      else {
        return result
      }
    }
  }

  private async iterate(instance: IBot, ctx: ContextMessageUpdate, gen: AsyncGenerator | Func, options: IIteratorOpts = {}) {
    let nextValue: any
    //@ts-ignore
    instance[ SYM_CONTEXT ] = ctx

    if (typeof gen === 'function') {
      const { parameters = [] } = options
      gen = gen.apply(instance, parameters)
    }

    if (!isGenerator(gen)) {
      const result = await gen
      return result
    }

    while (true) {
      const iterationResult = await gen.next(nextValue)
      nextValue = undefined
      const { value, done } = iterationResult

      if (done) {
        return value ?? nextValue
      }

      if (typeof value === 'string') {
        await this.replyMessage({ message: value }, ctx)
        continue
      }
      else if (typeof value === 'number') {
        await this.replyMessage({ message: value.toString() }, ctx)
        continue
      }
      else if (typeof value !== 'object') { continue }

      if (isInputOptions(value)) {
        if (this.executingCommand.has(instance)) {
          this.askedInputInCommand.set(instance, true)
        }

        nextValue = await this.askForInput(value, ctx)
      }
      else if ('message' in value) {
        nextValue = await this.replyMessage(value, ctx)
      }
      else if (isNotificationInfo(value)) {
        await this.notifyUsers(options.name!, options.type!, value, ctx)
        continue
      }

      if (typeof nextValue === 'string' && nextValue.startsWith('/')) {
        return
      }
    }
  }

  async askForInput(inputObj: IInputOpts, ctx: ContextMessageUpdate) {
    let {
      match,
      matchError = 'Invalid Input',
      retry = 0,
      timeout,
      keepAsking = false,
      didMessageSend,
      cancelPrevious,
      matchErrorExtra,
    } = inputObj

    if (!keepAsking) {
      //@ts-ignore
      const lastMessage = await this.replyMessage(inputObj, ctx)
      await didMessageSend?.(lastMessage)
    }

    do {
      --retry

      if (keepAsking) {
        //@ts-ignore
        const lastMessage = await this.replyMessage(inputObj, ctx)
        await didMessageSend?.(lastMessage)
      }

      let userMessage: IncomingMessage
      if (cancelPrevious) {
        userMessage = await WaitingStates.cancelAndReplace(ctx.from!.id, false, timeout)
      }
      else {
        userMessage = await WaitingStates.waitForUser(ctx.from!.id, false, timeout)
      }

      //@ts-ignore
      if (userMessage === SYM_PROMISE_REPLACE) {
        return userMessage
      }

      if (match) {
        if (typeof match === 'string') {
          match = new RegExp(match)
        }

        if (!userMessage.text) {
          if (matchError) {
            await this.replyMessage({ message: _(matchError, ctx.from?.language_code || 'en', matchError) }, ctx)
          }

          continue
        }

        const { text } = userMessage
        if (text.match(match)) {
          return text
        }
        else if (matchError && retry > 0) {
          let message = _(matchError, ctx.from?.language_code || 'en', matchError)
          await this.replyMessage({ message, extra: matchErrorExtra }, ctx)
        }
      }
      else {
        return userMessage.text
      }
    }
    while (retry > 0)

    return false
  }

  async replyMessage(messageObj: IReplyMessage, ctx: ContextMessageUpdate) {
    const {
      //@ts-ignore
      input,
      //@ts-ignore
      edit,

      message = input,
      extra,
    } = messageObj

    if (typeof message === 'string') {
      if (edit) {
        if ((edit as Message).text === message) {
          return false
        }

        return await ctx.telegram.editMessageText(ctx.chat?.id, edit.message_id, undefined, message, extra)
      }
      else {
        return await ctx.reply(message, extra)
      }
    }
    else {
      throw new Error('replyMessage can only send string messages for now.')
    }
  }

  async notifyUsers(name: string, type: 'action' | 'command' | 'hears', messageObj: INotificationInfo, ctx: ContextMessageUpdate): Promise<boolean | Error | (boolean | Error)[] | undefined> {
    const { format, notify, extra } = messageObj
    const { username, id } = ctx.from!
    const now = new Date()
    const epoch = ~~(now.getTime() / 1000)

    const data = {
      id,
      username,
      epoch,
      date: now,
      now,
      type,
      name,

      i: id,
      u: username,
      d: now,
      e: epoch,
      t: type,
      n: name,
    }

    const result = compileTemplate(format)(data)

    if (typeof notify === 'string' || typeof notify === 'number') {
      try {
        await ctx.telegram.sendMessage(notify, result, extra)
        return true
      }
      catch (error) {
        if (typeof error === 'string') {
          error = new Error(error)
        }

        return error
      }
    }
    else if (Array.isArray(notify)) {
      for (let i = notify.length - 1; i >= 0; --i) {
        const target = notify[ i ]

        try {
          await ctx.telegram.sendMessage(target, result, extra)
          //@ts-ignore
          notify[ i ] = true
        }
        catch (error) {
          if (typeof error === 'string') {
            error = new Error(error)
          }

          notify[ i ] = error
        }
      }

      return notify as any as boolean[]
    }
  }

  private emit(instance: any, name: string, type: 'e' | 'i', data?: any) {
    if (!(SYM_EVENTS in instance)) { return }
    if (typeof data !== 'undefined') {
      if (typeof data !== 'string') {
        data = JSON.stringify(data)
      }
    }

    return instance[ SYM_EVENTS ].next({
      name,
      type,
      data
    })
  }

  private canFire(instance: any, ctx: ContextMessageUpdate, initializer: InitSettings) {
    const { from } = ctx
    if (!from) { return false }

    const { name, type } = initializer

    if ('opts' in initializer) {
      const { opts } = initializer
      const { onceForBot, onceForBotIn } = opts

      if (onceForBot) {
        let settings = this.onceExecutions.get(instance)
        if (!settings) {
          this.onceExecutions.set(instance, settings = {})
        }

        if (settings[ name ]) {
          return false
        }

        settings[ name ] = true
        return true
      }
      else if (onceForBotIn) {
        let settings = this.onceExecutions.get(instance)
        if (!settings) {
          this.onceExecutions.set(instance, settings = {})
        }

        const now = (new Date()).getTime()
        if (name in settings) {
          const execTime = settings[ name ]
          if (now > execTime) {
            settings[ name ] = now + onceForBotIn
            return true
          }
          else {
            return false
          }
        }
        else {
          settings[ name ] = now + onceForBotIn
          return true
        }
      }

      if ('onceForUser' in opts || 'onceForUserIn' in opts) {
        const { onceForUser, onceForUserIn } = opts
        const state = instance[ SYM_STATE ] as Dictionary<{ value: any, props: IBotStateSettings }>
        const userSettings = (
          state[ SYM_ONCE as any as string ]
          || (state[ SYM_ONCE as any as string ] = {
            value: {} as Dictionary<Dictionary<{ interval: number }>>,
            props: {}
          })
        ).value

        if (onceForUser) {
          if (!(type in userSettings)) {
            userSettings[ type ] = {}
          }

          const funTypes = userSettings[ type ]
          if (!(name in funTypes)) {
            funTypes[ name ] = Infinity
            return true
          }
          else {
            return false
          }
        }
        else if (onceForUserIn) {
          if (!(type in userSettings)) {
            userSettings[ type ] = {}
          }

          const now = new Date().getTime()
          const funTypes = userSettings[ type ]
          if (!(name in funTypes)) {
            funTypes[ name ] = now + onceForUserIn
            return true
          }
          else {
            const allowanceEpoch = funTypes[ name ]
            if (now > allowanceEpoch) {
              funTypes[ name ] = now + onceForUserIn
              return true
            }
            else {
              return false
            }
          }
        }
      }
    }

    return true
  }
}

const executer = new Executer()

export function handleActions(instance: any, initializer: InitSettings) {
  return async function (ctx: ContextMessageUpdate) {
    instance[ SYM_CONTEXT ] = ctx
    await executer.fireOnAction(instance, ctx, initializer)
  }
}

export function handleCommand(instance: any, initializer: InitSettings) {
  return async function (ctx: ContextMessageUpdate) {
    instance[ SYM_CONTEXT ] = ctx
    await executer.fireOnCommand(instance, ctx, initializer)
  }
}

export function handleHears(instance: any, initializer: InitSettings) {
  return async function (ctx: ContextMessageUpdate) {
    instance[ SYM_CONTEXT ] = ctx
    await executer.fireOnHears(instance, ctx, initializer)
  }
}

export function handleGeneric(instance: any, initializer: InitSettings) {
  return async function (ctx: ContextMessageUpdate) {
    instance[ SYM_CONTEXT ] = ctx
    await executer.fireGeneric(instance, ctx, initializer)
  }
}

export function askForInput(inputObj: IInputOpts, ctx: ContextMessageUpdate) {
  return executer.askForInput(inputObj, ctx)
}

export function replyMessage(messageObj: IReplyMessage, ctx: ContextMessageUpdate) {
  return executer.replyMessage(messageObj, ctx)
}

function _resetMatch(instance: any, a: any, b: any, c: any, d: any, e: any, f: any, g: any, h: any, i: any, j: any) {
  instance[ '$0' ] = a
  instance[ '$1' ] = b
  instance[ '$2' ] = c
  instance[ '$3' ] = d
  instance[ '$4' ] = e
  instance[ '$5' ] = f
  instance[ '$6' ] = g
  instance[ '$7' ] = h
  instance[ '$8' ] = i
  instance[ '$9' ] = j
}

function _resetMatchArray(instance: any, array: any[]) {
  _resetMatch(
    instance,
    array[ 0 ],
    array[ 1 ],
    array[ 2 ],
    array[ 3 ],
    array[ 4 ],
    array[ 5 ],
    array[ 6 ],
    array[ 7 ],
    array[ 8 ],
    array[ 9 ]
  )
}
