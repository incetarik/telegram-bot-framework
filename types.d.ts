declare interface BotEvent {
  /**
   * The name of the event.
   *
   * @type {string}
   * @memberof Event
   */
  name: string

  /**
   * The optional data of the event.
   *
   * @type {*}
   * @memberof Event
   */
  data?: any

  /**
   * The type of the event.
   *
   * @type {('i' | 'e')}
   * @memberof Event
   */
  type: 'i' | 'e'
}

declare interface Dictionary<T = any> {
  [ key: string ]: T
  [ key: number ]: T
}

declare type Func<TReturn = any, TArgs extends any[] = any[]> = (...args: TArgs) => TReturn

declare interface IBotStateSettings {
  /**
   * The timeout of the property.
   *
   * When this is set, a timer is also set for thsi property, when the time
   * outs, the property will be set to `undefined` and will emit an event if
   * it is not set to false.
   *
   * No timeout by default.
   * Emits `prop.timeout` event.
   *
   * @type {number}
   * @memberof BotStateSettings
   */
  timeout?: number

  /**
   * Limits the `read` count.
   *
   * If the reading is done as much as this value, the value will be set to
   * `undefined`.
   *
   * No usage count by default.
   * Emits `prop.expired` event.
   *
   * @type {number}
   * @memberof BotStateSettings
   */
  usageCount?: number

  /**
   * The value of the property when its expired or timed-out.
   *
   * If no other related defaulting values is given, this value will be used
   * instead of them. Otherwise, they will be used for their related events.
   *
   * `initial value` by default.
   *
   * @type {*}
   * @memberof IBotStateSettings
   */
  defaultsTo?: any

  /**
   * Indicates whether the resetting operation should be done once when
   * the property is expired or timed-out.
   *
   * `false` by default.
   *
   * @type {boolean}
   * @memberof IBotStateSettings
   */
  resetOnce?: boolean

  /**
   * The value of the property that will be set when the property times out.
   *
   * If this property is not set and `defaultsTo` is set, then that will be
   * used instead.
   *
   * `initial value` by default.
   *
   * @type {*}
   * @memberof IBotStateSettings
   */
  defaultWhenTimeouts?: any

  /**
   * The value of the property that will be set when the property expires.
   *
   * If this property is not set and `defaultsTo` is set, then that will be
   * used instead.
   *
   * `initial value` by default.
   *
   * @type {*}
   * @memberof IBotStateSettings
   */
  defaultWhenExpires?: any

  /**
   * Indicates whether reading this variable resets its expiration timer.
   *
   * - `false` by default.
   * - Emits `prop.timerreset` event.
   *
   * @type {boolean}
   * @memberof BotStateSettings
   */
  readingResetsTimer?: boolean

  /**
   * Indicates whether writing to this variable resets its expiration timer.
   *
   * - `false` by default.
   * - Emits `prop.timerreset` event.
   *
   * @type {boolean}
   * @memberof BotStateSettings
   */
  writingResetsTimer?: boolean

  /**
   * Indicates whether the events for this property will be emitted or not.
   *
   * `false` by default.
   *
   * @type {boolean}
   * @memberof BotStateSettings
   */
  emitsEvent?: boolean
}

declare interface ICommandDecoratorOpts {
  /**
   * The name of the command. This should match with the command name sent
   * by the client.
   *
   * This is the same with the function name by default.
   *
   * @type {string}
   * @memberof ICommandDecoratorOpts
   */
  name?: string

  /**
   * Indicates whether the function call emits an event or not.
   *
   * `false` by default.
   *
   * @type {boolean}
   * @memberof IActionDecoratorOpts
   */
  emitsEvent?: boolean

  /**
   * Resets/removes the states when the command is executed again during
   * another command is processing.
   *
   * It is also possible to provide a default value for a property name.
   *
   * @type {(string | [ string, any ])[]}
   * @memberof ICommandDecoratorOpts
   */
  resetStates?: (string | [ string, any ])[]

  /**
   * Indicates which user may execute this command.
   *
   * The value can be either the user id, username, or array of these two.
   *
   * Additionally, it can be a function to determine whether the user has
   * rights to execute this call. If the function is passed, the parameters
   * will be the id of the user, and the username of the user if provided.
   * Return `true` if user has right to execute this function.
   *
   * @type {((id: number, username?: string) => (boolean | Promise<boolean>)) | string | number | (string | number)[]}
   * @memberof ICommandDecoratorOpts
   */

  onlyFor?: ((id: number, username?: string) => (boolean | Promise<boolean>)) | string | number | (string | number)[]

  /**
   * The name of the function in the class to handle unauthorized execution
   * of commands. This function will be called when the `onlyFor` filter
   * is set and the user executing the related function is not authorized.
   *
   * `onUnauthorizedCommand` by default.
   *
   * If the class has the function, the function will be called by these
   * parameters:
   *
   * `commandName`, `userId`, `userName`, `context`
   *
   * **NOTE**: If the function is not found, the function will ignore the
   * execution silently.
   *
   * @type {string}
   * @memberof ICommandDecoratorOpts
   */
  unauthorizedExecHandlerName?: string

  /**
   * The timeout value for the function.
   * If user does not respond to the message, the generator will be cancelled.
   *
   * @type {number}
   * @memberof ICommandDecoratorOpts
   */
  timeout?: number

  /**
   * The error to reply to the user when timeout occurs.
   *
   * @type {string}
   * @memberof ICommandDecoratorOpts
   */
  timeoutMessage?: string
}

declare interface IActionDecoratorOpts {
  /**
   * Name alias of the function.
   * If given, the `callback_data` should be equal to the given name, not the
   * function name. Otherwise, this is the same with function name by default.
   *
   * @type {string}
   * @memberof IActionDecoratorOpts
   */
  name?: string

  /**
   * Indicates whether the function call emits an event or not.
   *
   * `false` by default.
   *
   * @type {boolean}
   * @memberof IActionDecoratorOpts
   */
  emitsEvent?: boolean
}

declare interface IHearsDecoratorOpts {
  /**
   * The regular expression or the exact string to match from the user message.
   * If the type of this is string, then the exact match is expected.
   *
   * @type {(RegExp | string)}
   * @memberof IHearsDecoratorOpts
   */
  match: RegExp | string

  /**
   * The number of times the function may be executed when the user message
   * matches.
   *
   * `Infinity` by default.
   *
   * @type {number}
   * @memberof IHearsDecoratorOpts
   */
  executeCount?: number

  /**
   * Indicates whether the function call emits an event or not.
   *
   * `false` by default.
   *
   * @type {boolean}
   * @memberof IHearsDecoratorOpts
   */
  emitsEvent?: boolean

  /**
   * Indicates whether the match results should be kept in the related
   * match properties of the class, instead of resetting them at the end
   * of the function.
   *
   * `false` by default.
   *
   * @type {boolean}
   * @memberof IHearsDecoratorOpts
   */
  keepMatchResults?: boolean

  /**
   * Indicates whether the function should be executed even if the user is
   * responding to a command for now.
   *
   * `false` by default.
   *
   * @type {boolean}
   * @memberof IHearsDecoratorOpts
   */
  executeDuringCommand?: boolean

  /**
   * Indicates whether the other `@hears` functions may be executed during the
   * execution of this hears function.
   *
   * For example, if this is `false`, and the function has `input$()` inside
   * waiting for an input from the user, and the user has replied with a
   * message which matches with any of other hears of the bot
   * (including this one), then the other hears functions will not be executed.
   *
   * @type {boolean}
   * @memberof IHearsDecoratorOpts
   */
  othersMayHear?: boolean
}
