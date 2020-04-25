import { Observable, Subject } from 'rxjs'
import Telegraf, { ContextMessageUpdate } from 'telegraf'
import {
  ExtraEditMessage, IncomingMessage, Message
} from 'telegraf/typings/telegram-types'

import { createBot, IBotSettings } from '../create-bot'
import { WaitingStates } from '../common'
import { _ } from '../translations'
import {
  INIT_MAP, SYM_ACTIONS, SYM_COMMANDS, SYM_CONTEXT, SYM_EVENTS,
  SYM_PROMISE_REPLACE, SYM_STATE
} from './common'

export interface IBot {
  /**
   * Reference to the Telegraf instance.
   *
   * @type {Telegraf<ContextMessageUpdate>}
   * @memberof IBot
   */
  readonly ref: Telegraf<ContextMessageUpdate>

  /**
   * Initializes the class and provides a platform for other decorated
   * properties and functions.
   *
   * This function should be called at the beginning of the bot, if,
   * the start function is implemented manually.
   *
   * @memberof IBot
   */
  init(): void

  /**
   * The start function of the bot.
   *
   * This function calls `init()` to initialize the environment of the bot
   * and `launch()` and `startPolling()` functions of the Telegraf instance
   * **if this is not defined manually**.
   *
   * @memberof IBot
   */
  start(): void

  /**
   * Expects an input from the user.
   *
   * @param {(IInputOpts | string)} obj Input options or just the message.
   * @returns {(Promise<string | false>)} A promise of string or false.
   * - Resolves with false when user input is not matched according to given
   * `match` option and no trials left.
   * - Resolves with the string of user input if user input is matching with
   * the given regular expression. If no `match` is set, then this is the
   * message user replied.
   *
   * @memberof IBot
   */
  input$(obj: IInputOpts | string): Promise<string | false>

  /**
   * Sends a message to the user.
   *
   * @param {(IReplyMessage | string)} obj Message options or just the message.
   * @returns {Promise<boolean | Message>} A promise that will be resolved when
   * the message is sent.
   * - Resolves with false if the `obj` was containing a message to edit and
   * the contents of the message were equal.
   * - Resolves with message sent by the bot on success, resolves with true
   * otherwise.
   *
   * @memberof IBot
   */
  message$(obj: IReplyMessage | string): Promise<boolean | Message>

  /**
   * Checks whether the input returned from `input$()` was cancel symbol
   * or not. So you can check whether the previous operation is cancelled
   * or not.
   *
   * This is expected when, user takes an action without sending a message.
   * Since the action itself is treated as a return from user, the
   * `WaitingStates` will resolve the message, although the user did not
   * sent any.
   *
   * Therefore, always use this after you resolve the user input if you also
   * provide actions with the input message.
   *
   * @example
   * ```
   * const selection = await this.input$({
   *  input: `Please choose an index: ${indexList}`,
   *  match: /^(next|prev|cancel|\d\d?)$/i,
   *  extra: Extra.markup(Markup.inlineKeyboard([
   *    { text: 'Prev', callback_data: 'didPrevClick', hide: false },
   *    { text: 'Next', callback_data: 'didNextClick', hide: false },
   *  ])),
   *  edit: this._messageToUpdate,
   *  cancelPrevious: true,
   *  didMessageSend: async message => { this._messageToUpdate = message }
   * })
   *
   * if (this.isCancelled(selection)) {
   *   // Simply return, the message is sent by the `WaitingStates`, not by
   *   // the user, hence it could be skipped. The selection above is probably
   *   // used in generator and replaced with the new page after an action
   *   // and the previous promise returned from the old page is useless.
   *   return
   * }
   * ```
   *
   * @param {*} thing The message resolved from the `input$()` function.
   * @returns {boolean} `true` if the message is a cancel symbol.
   * @memberof IBot
   */
  isCancelled(thing: any): boolean

  /**
   * Cancels awaiting an input. Use this function in cleanup functions, such
   * as discards, cancels, and similar actions.
   *
   * @example
   * ```js
   * class SearchBot {
   *   @state() private query = ''
   *   @state() private index = 0
   *
   *   @action()
   *   async didCancelPress() {
   *     this.cancelInput()
   *     this.query = ''
   *     this.index = 0
   *   }
   * }
   * ```
   *
   * @returns {boolean} `true` if cancelled, `false` if it was not awaited.
   * @memberof IBot
   */
  cancelInput(): boolean

  /**
   * Returns an observable for listening events emitted from this class.
   *
   * @returns {Observable<Event>} An observable for listening events.
   * @memberof IBot
   */
  listenEvents$(): Observable<Event>

  /**
   * The current message context.
   *
   * @type {ContextMessageUpdate}
   * @memberof IBot
   */
  readonly context: ContextMessageUpdate
}

/**
 * Marks a class as the bot implementation logic and prepares a platform for
 * other decorators such as `state()`, `action()` and `@command()`.
 *
 * This decorators adds bunch of new functions to the class, hence for type
 * safety, you can write an empty interface extending `IBot` with the same
 * name of your class. Hence, you will get your type definitions.
 *
 * @example
 * ```js
 * export interface SearchBot extends IBot {}
 *
 * @bot()
 * export class SearchBot {
 *   // Implementation here
 * }
 * ```
 *
 * @export
 * @param {IBotSettings} [opts] Options for the bot.
 * @returns
 */
export function bot(opts?: IBotSettings) {
  const {
    catchFunction = 'onError',
  } = (opts || {});

  return function botClass<T extends { new(...args: any[]): {} }>(constr: T) {
    let reference: Telegraf<ContextMessageUpdate>
    const actions: Dictionary<Function> = {}
    const commands: Dictionary<Function> = {}
    const state: Dictionary<Dictionary<{ value: any, props: IBotStateSettings }>> = {}
    let eventSubject: Subject<Event>

    Object.defineProperties(constr.prototype, {
      ref: {
        configurable: false,
        get() {
          return reference || (reference = createBot(opts || {}))
        }
      },
      init: {
        configurable: false,
        value() {
          const initArray = INIT_MAP.get(constr.prototype)
          if (initArray) {
            initArray.forEach(it => {
              if (it.type === 'action') {
                this.ref.action(it.name, async (ctx: ContextMessageUpdate) => {
                  this[ SYM_CONTEXT ] = ctx
                  const gen = it.value.call(this, ctx)
                  return await execute(gen(), ctx)
                })
              }
              else {
                this.ref.command(it.name, async (ctx: ContextMessageUpdate) => {
                  this[ SYM_CONTEXT ] = ctx
                  const gen = it.value.call(this, ctx)
                  return await execute(gen(), ctx)
                })
              }
            })

            INIT_MAP.delete(constr.prototype)
          }

          if (catchFunction in this) {
            this.ref.catch(this[ catchFunction ].bind(this))
          }
        }
      },
      [ SYM_ACTIONS ]: {
        configurable: false,
        enumerable: false,
        get() {
          return actions
        }
      },
      [ SYM_COMMANDS ]: {
        configurable: false,
        enumerable: false,
        get() {
          return commands
        }
      },
      [ SYM_EVENTS ]: {
        configurable: false,
        enumerable: false,
        get() {
          return eventSubject || (eventSubject = new Subject())
        }
      },
      [ SYM_CONTEXT ]: {
        enumerable: false,
        writable: true,
        value: undefined
      },
      [ SYM_STATE ]: {
        configurable: false,
        enumerable: false,
        get() {
          const context = this[ SYM_CONTEXT ] as ContextMessageUpdate
          if (!context) { return undefined }
          const { from } = context
          if (!from) { return undefined }
          const { id } = from
          //@ts-ignore
          const userState = (state[ id ] || (state[ id ] = {}))
          return userState
        }
      },
    })

    if (!('start' in constr.prototype)) {
      Object.defineProperty(constr.prototype, 'start', {
        configurable: false,
        value() {
          this.init()
          this.ref.launch()
          this.ref.startPolling()
        }
      })
    }

    Object.defineProperties(constr.prototype, {
      input$: {
        configurable: false,
        value(inputObj: IInputOpts | string) {
          if (typeof inputObj === 'string') {
            inputObj = {
              input: inputObj,
            }
          }

          return askForInput(inputObj, this.context)
        }
      },
      message$: {
        configurable: false,
        value(messageObj: IReplyMessage | string) {
          if (typeof messageObj === 'string') {
            messageObj = {
              message: messageObj
            }
          }

          return replyMessage(messageObj, this.context)
        }
      },
      isCancelled: {
        configurable: false,
        value(thing: any): thing is typeof SYM_PROMISE_REPLACE {
          return thing === SYM_PROMISE_REPLACE
        }
      },
      cancelInput: {
        configurable: false,
        value() {
          //@ts-ignore
          return WaitingStates.resolveFor(this.context.from!.id, SYM_PROMISE_REPLACE)
        }
      },
      listenEvents$: {
        configurable: false,
        value() {
          return (this[ SYM_EVENTS ] as Subject<Event>).asObservable()
        }
      }
    })

    return constr
  }
}

async function execute(generator: AsyncGenerator, ctx: ContextMessageUpdate) {
  let lastRequestResult: any
  do {
    const iteratorResult: IteratorResult<any> = await generator.next(lastRequestResult)
    lastRequestResult = undefined
    if (iteratorResult.done) {
      return iteratorResult.value || lastRequestResult
    }
    else {
      const { value: request } = iteratorResult
      if (typeof request !== 'object') { continue }
      if ('input' in request) {
        lastRequestResult = await askForInput(request, ctx)
      }
      else if ('message' in request) {
        lastRequestResult = await replyMessage(request, ctx)
      }
    }
  }
  while (true)
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

async function askForInput(inputObj: IInputOpts, ctx: ContextMessageUpdate) {
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
    const lastMessage = await replyMessage(inputObj, ctx)
    await didMessageSend?.(lastMessage)
  }

  do {
    --retry

    if (keepAsking) {
      //@ts-ignore
      const lastMessage = await replyMessage(inputObj, ctx)
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
          await replyMessage({ message: _(matchError, ctx.from?.language_code || 'en', matchError) }, ctx)
        }

        continue
      }

      const { text } = userMessage
      if (text.match(match)) {
        return text
      }
      else if (matchError && retry > 0) {
        let message = _(matchError, ctx.from?.language_code || 'en', matchError)
        await replyMessage({ message, extra: matchErrorExtra }, ctx)
      }
    }
    else {
      return userMessage.text
    }
  }
  while (retry > 0)

  return false
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

async function replyMessage(messageObj: IReplyMessage, ctx: ContextMessageUpdate) {
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
