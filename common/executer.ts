import { ContextMessageUpdate } from 'telegraf';
import { SYM_CONTEXT, InitSettings, SYM_PROMISE_REPLACE, isGenerator, SYM_EVENTS, SYM_STATE, SYM_HEAR_EXEC_COUNTS } from '../decorators/common';
import { IBot } from '../decorators';
import { ExtraEditMessage, Message, IncomingMessage } from 'telegraf/typings/telegram-types';
import { WaitingStates } from './waiting-states';
import { _ } from '../translations';

type IIteratorOpts = {
  timeout?: number,
  timeoutMessage?: string,
}

/**
* The input options.
*
* @export
* @interface IInputOpts
*/
export interface IInputOpts {
  /**
   * The message to send to the user for the input.
   *
   * @type {string}
   * @memberof IInputOpts
   */
  input: string

  /**
   * The regular expression or the string to match the string.
   *
   * Will be translated if found as a key.
   *
   * @type {(string | RegExp)}
   * @memberof IInputOpts
   */
  match?: string | RegExp

  /**
   * The error to send to the user if user input was not matched.
   *
   * Will be translated if found as a key.
   *
   * @type {string}
   * @memberof IInputOpts
   */
  matchError?: string

  /**
   * The extra options to show the error message.
   *
   * @type {ExtraEditMessage}
   * @memberof IInputOpts
   */
  matchErrorExtra?: ExtraEditMessage

  /**
   * The number of trials given to the user. If all of the user inputs
   * were mismatched, then the function will end with `false` value.
   *
   * @type {number}
   * @memberof IInputOpts
   */
  retry?: number

  /**
   * Timeout for the user input.
   *
   * @type {number}
   * @memberof IInputOpts
   */
  timeout?: number

  /**
   * Indicates whether the input should be asked again and again until user
   * sends a valid matching message.
   *
   * @type {boolean}
   * @memberof IInputOpts
   */
  keepAsking?: boolean

  /**
   * The previous message of the bot to edit the message content.
   * This could be used to reduce the number of messages the bot sends if the
   * messages are similar to each other, like listing.
   *
   * This property is useful with `didMessageSend()` function, get the sent
   * message with that function and keep it around and pass it to this
   * property to let the bot update that sent message. In this way, it is
   * possible to have paginated messages which is useful for providing list
   * of options to the user.
   *
   * @type {Message}
   * @memberof IInputOpts
   */
  edit?: Message

  /**
   * The extra options to show the input message.
   *
   * @type {ExtraEditMessage}
   * @memberof IInputOpts
   */
  extra?: ExtraEditMessage

  /**
   * Indicates whether this input may cancel the previously waited message
   *
   * The other functions which would wait for an user input should check
   * whether the value returned from their yields or awaits is cancel symbol.
   *
   * For that, `this.isCancelled(result)` can be used. In this way, if two
   * functions are waiting for user input or one function is re-executed and
   * the previous await should be ignored can be determined.
   *
   * @type {boolean}
   * @memberof IInputOpts
   */
  cancelPrevious?: boolean

  /**
   * The function that catches the sent message and passes as an argument.
   * Use this function to keep the sent message by the bot so that you
   * can use it for the `edit` property of this input settings.
   * In that way, you will be able to replace the previous message.
   *
   * @param {Message} message The message sent to the user.
   * @returns {Promise<void>} Promise function.
   * @memberof IInputOpts
   */
  didMessageSend?(message: Message): Promise<void>
}

/**
 * The reply message settings.
 *
 * @export
 * @interface IReplyMessage
 */
export interface IReplyMessage {
  /**
   * The message to send to the user.
   *
   * @type {string}
   * @memberof IReplyMessage
   */
  message: string

  /**
   * The extra of the message which will be sent to the user.
   *
   * @type {ExtraEditMessage}
   * @memberof IReplyMessage
   */
  extra?: ExtraEditMessage
}

class Executer {
  private askedInputInCommand: WeakMap<any, boolean> = new WeakMap()
  private executingCommand: WeakMap<any, { genOrPromise: AsyncGenerator | Promise<any>, initializer: InitSettings }> = new WeakMap()
  private executingHear: WeakMap<any, boolean> = new WeakMap()

  async fireHelp(instance: IBot, ctx: ContextMessageUpdate, initializer: InitSettings) {
    const genOrPromise = initializer.handler.call(instance, ctx)

    if (isGenerator(genOrPromise)) {
      return await this.iterate(instance, ctx, genOrPromise)
    }
    else {
      return await genOrPromise
    }
  }

  async fireOnCommand(instance: IBot, ctx: ContextMessageUpdate, initializer: InitSettings) {
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
    instance.context = ctx
    //@ts-ignore
    instance[ SYM_CONTEXT ] = ctx

    const generator = this.wrapper(instance, handler, ctx, { timeout, timeoutMessage })()
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
    instance.context = ctx

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
      instance.context = ctx

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

        let returnValue: any
        let nextValue: any

        while (true) {
          const iterationResult = await result.next(nextValue)
          nextValue = undefined
          const { value, done } = iterationResult

          if (done) {
            returnValue = value ?? nextValue
            break
          }

          if (typeof value === 'string') {
            await that.replyMessage({ message: value }, ctx)
            continue
          }
          else if (typeof value === 'number') {
            await that.replyMessage({ message: value.toString() }, ctx)
            continue
          }
          else if (typeof value !== 'object') { continue }

          if ('input' in value) {
            if (that.executingCommand.has(instance)) {
              that.askedInputInCommand.set(instance, true)
            }

            nextValue = await that.askForInput(value, ctx)
          }
          else if ('message' in value) {
            nextValue = await that.replyMessage(value, ctx)
          }

          if (typeof nextValue === 'string' && nextValue.startsWith('/')) {
            returnValue = undefined
            break
          }
        }

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

  private async iterate(instance: IBot, ctx: ContextMessageUpdate, gen: AsyncGenerator, options: IIteratorOpts = {}) {
    let nextValue: any

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

      if ('input' in value) {
        if (this.executingCommand.has(instance)) {
          this.askedInputInCommand.set(instance, true)
        }

        nextValue = await this.askForInput(value, ctx)
      }
      else if ('message' in value) {
        nextValue = await this.replyMessage(value, ctx)
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

export function handleHelp(instance: any, initializer: InitSettings) {
  return async function (ctx: ContextMessageUpdate) {
    instance[ SYM_CONTEXT ] = ctx
    await executer.fireHelp(instance, ctx, initializer)
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
