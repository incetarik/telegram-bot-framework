import { Observable, Subject } from 'rxjs'
import Telegraf, { ContextMessageUpdate, Middleware } from 'telegraf'
import { Message } from 'telegraf/typings/telegram-types'

import { WaitingStates } from '../common'
import {
  askForInput, handleActions, handleCommand, handleHears, IInputOpts,
  IReplyMessage, replyMessage, handleGeneric
} from '../common/executer'
import { createBot, IBotSettings } from '../create-bot'
import {
  INIT_MAP, SYM_CONTEXT, SYM_EVENTS,
  SYM_PROMISE_REPLACE, SYM_STATE, SYM_HEAR_EXEC_COUNTS
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
   * Runs the bot.
   *
   * This function calls `init()` to initialize the environment of the bot
   * and `launch()` and `startPolling()` functions of the Telegraf instance
   * **if this is not defined manually**.
   *
   * @memberof IBot
   */
  run(): void

  /**
   * Resets all of the bot states for the executing user.
   *
   * @memberof IBot
   */
  resetStates(): void

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

  /**
   * The last match of the `@hears` decorated function.
   *
   * @type {RegExpMatchArray}
   * @memberof IBot
   */
  readonly lastMatch?: RegExpMatchArray

  /**
   * The whole last match.
   *
   * @type {string}
   * @memberof IBot
   */
  readonly $0?: string

  /**
   * The first group in the last match.
   *
   * @type {string}
   * @memberof IBot
   */
  readonly $1?: string

  /**
   * The second group in the last match.
   *
   * @type {string}
   * @memberof IBot
   */
  readonly $2?: string

  /**
   * The thirhd group in the last match.
   *
   * @type {string}
   * @memberof IBot
   */
  readonly $3?: string

  /**
   * The fourth group in the last match.
   *
   * @type {string}
   * @memberof IBot
   */
  readonly $4?: string

  /**
   * The fifth group in the last match.
   *
   * @type {string}
   * @memberof IBot
   */
  readonly $5?: string

  /**
   * The sixty group in the last match.
   *
   * @type {string}
   * @memberof IBot
   */
  readonly $6?: string

  /**
   * The seventh group in the last match.
   *
   * @type {string}
   * @memberof IBot
   */
  readonly $7?: string

  /**
   * The eighth group in the last match.
   *
   * @type {string}
   * @memberof IBot
   */
  readonly $8?: string

  /**
   * The ninth group in the last match.
   *
   * @type {string}
   * @memberof IBot
   */
  readonly $9?: string
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
    helpFunction = 'help',
    startFunction = 'start',
    catchFunction = 'onError',
    use,
  } = (opts || {});

  return function botClass<T extends { new(...args: any[]): {} }>(constr: T) {
    let isStartSet = false
    let initialized = false
    let helpSet: string | undefined
    let eventSubject: Subject<Event>
    let reference: Telegraf<ContextMessageUpdate>

    const initialHearsExecutions: Dictionary<number> = {}
    const state: Dictionary<Dictionary<{ value: any, props: IBotStateSettings }>> = {}

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
          if (initialized) { return false }

          const initArray = INIT_MAP.get(constr.prototype)
          if (initArray) {
            const commandsAdded: string[] = []

            initArray.forEach(it => {
              switch (it.type) {
                case 'action': {
                  this.ref.action(it.name, handleActions(this, it))
                  break
                }

                case 'command': {
                  if (commandsAdded.indexOf(it.name) >= 0) {
                    throw new Error(`The command /${it.name} is already added before`)
                  }

                  this.ref.command(it.name, handleCommand(this, it))
                  commandsAdded.push(it.name)
                  break
                }

                case 'hears': {
                  this.ref.hears(it.match, handleHears(this, it))
                  const { executeCount = Infinity } = it.opts
                  if (it.name in initialHearsExecutions) {
                    throw new Error(`The hears ${it.name} is already added before`)
                  }

                  initialHearsExecutions[ it.name ] = executeCount
                  break
                }

                case 'help': {
                  if (helpSet) {
                    throw new Error(`A help function is already set before: ${helpSet}`)
                  }

                  this.ref.help(handleGeneric(this, it))
                  helpSet = it.name
                  break
                }

                case 'start': {
                  if (isStartSet) {
                    throw new Error('The start function is already set before')
                  }

                  this.ref.start(handleGeneric(this, it))
                  isStartSet = true
                  break
                }

                default: {
                  throw new Error(`Invalid information: ${JSON.stringify(it)}`)
                }
              }
            })

            INIT_MAP.delete(constr.prototype)
          }

          if (catchFunction in this) {
            this.ref.catch(this[ catchFunction ].bind(this))
          }

          if (helpFunction in this) {
            if (helpSet) {
              throw new Error(`A help function is already set before: ${helpSet}`)
            }

            this.ref.help(handleGeneric(this, { handler: this.help, name: 'help', type: 'help' }))
            helpSet = 'help'
          }

          if (startFunction in this) {
            this.ref.start(handleGeneric(this, { handler: this.start, name: 'start', type: 'start' }))
            isStartSet = true
          }

          if (typeof use !== 'undefined') {
            //@ts-ignore
            let useArray: Middleware<ContextMessageUpdate>[] = use
            if (!Array.isArray(use)) {
              useArray = [ use ]
            }

            this.ref.use(useArray.shift()!, ...useArray)
          }

          return initialized = true
        }
      },
      resetStates: {
        configurable: false,
        value() {
          WaitingStates[ 'cancelWaiting' ](this.context.from?.id)
          const userState = this[ SYM_STATE ] as Dictionary<{ value: any, props: IBotStateSettings }>
          for (const key in userState) {
            const prop = userState[ key ]
            if ('_reset' in prop.props) {
              //@ts-ignore
              prop.props[ '_reset' ]?.()
            }

            //@ts-ignore
            prop.value = prop.props[ '_defaultValue' ] ?? prop.props[ '_propDefault' ] ?? prop.props.defaultsTo
          }
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
      [ SYM_HEAR_EXEC_COUNTS ]: {
        configurable: false,
        enumerable: false,
        get() {
          const context = this[ SYM_CONTEXT ] as ContextMessageUpdate
          if (!context) { return undefined }
          const { from } = context
          if (!from) { return undefined }
          const { id } = from
          const userState = (state[ id ] || (state[ id ] = { [ SYM_HEAR_EXEC_COUNTS ]: { ...initialHearsExecutions } }))

          //@ts-ignore
          return userState[ SYM_HEAR_EXEC_COUNTS ]
        }
      },
    })

    if (!('run' in constr.prototype)) {
      Object.defineProperty(constr.prototype, 'run', {
        configurable: false,
        value() {
          this.init()
          this.ref.launch()
          this.ref.startPolling()
        }
      })
    }

    if (!('start' in constr.prototype)) {
      Object.defineProperty(constr.prototype, 'start', {
        configurable: false,
        value() {
          this.resetStates()
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
