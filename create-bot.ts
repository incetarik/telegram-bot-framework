import Telegraf, { TelegrafOptions, Middleware, ContextMessageUpdate } from 'telegraf'

import { WaitingStates } from './common'
import { initEnvironment } from './environment'

export interface IBotSettings extends TelegrafOptions {
  /**
   * The environment name of the token variable.
   * `BOT_TOKEN` by default.
   *
   * @type {string}
   * @memberof IBotSettings
   */
  tokenEnvName?: string

  /**
   * The name of the class function for catching errors.
   * `onError` by default.
   *
   * When a function is found in this name inside of the class, the function
   * will be used as error logger/handler.
   *
   * @type {string}
   * @memberof IBotSettings
   */
  catchFunction?: string

  /**
   * The name of the class function for help command.
   * `help` by default.
   *
   * When the user sends `/help` command, this function will be executed.
   * Or, the function marked with `@help` decorator will be executed.
   *
   * @type {string}
   * @memberof IBotSettings
   */
  helpFunction?: string

  /**
   * The name of the start function.
   * `start` by default.
   *
   * When the user sends `/start` command, this function will be executed.
   * Or, the function marked with `@start` decorator will be executed.
   *
   * @type {string}
   * @memberof IBotSettings
   */
  startFunction?: string

  /**
   * The name of the function for callback_query.
   * `onCallbackQuery` by default.
   *
   * When user reacts to a menu or unassigned reaction, it will be executed
   * automatically with the content of the callback_query.
   *
   * @type {string}
   * @memberof IBotSettings
   */
  callbackQueryFunction?: string

  /**
   * Indicates whether the callback query handler function of the bot should
   * not be called if the query is handled internally such as inline menu
   * queries.
   *
   * `true` by default.
   *
   * @type {boolean}
   * @memberof IBotSettings
   */
  skipHandledCallbackQueries?: boolean

  /**
   * Indicates that whether the status/action of the bot should be updated
   * automatically when sending a photo, video or audio.
   *
   * `true` by default.
   *
   * @type {boolean}
   * @memberof IBotSettings
   */
  autoUpdateStatus?: boolean

  /**
   * Integrates another middlewares to the bot.
   *
   * @param {...Middleware<ContextMessageUpdate>[]} middlewares Middlewares.
   * @memberof IBot
   */
  use?: Middleware<ContextMessageUpdate> | Middleware<ContextMessageUpdate>[]

  /**
   * Indicates whether to print the stack trace or not when an error occurs.
   *
   * This will be ignored if the catch function exists in the bot class.
   *
   * `true` by default
   *
   * @type {boolean}
   * @memberof IBotSettings
   */
  printStackTrace?: boolean

  /**
   * The token of the bot or a getter function for token.
   *
   * @memberof IBotSettings
   */
  token?: string | Func<string>
}

function _createBot(token: string, opts: IBotSettings) {
  const bot = new Telegraf(token, opts)

  bot.use((ctx, next) => {
    if (!ctx.message) { next!(); return }
    if (!ctx.from) { next!(); return }

    WaitingStates.resolveFor(ctx.from.id, ctx.message)
    next!()
  })

  return bot
}

/**
 * Creates a bot with given parameters.
 *
 * @export
 * @param {IBotSettings} opts Options for the bot.
 * @returns The Telegraf instance.
 *
 */
export function createBot(opts: IBotSettings) {
  initEnvironment()
  let { token, tokenEnvName = 'BOT_TOKEN' } = opts

  if (typeof token === 'function') {
    const result = token()
    if (typeof result === 'string') {
      token = result
    }
  }
  else if (typeof token === 'string') {
    return _createBot(token, opts)
  }

  if (typeof token !== 'string') {
    token = process.env[ tokenEnvName ] as string
  }

  if (typeof token !== 'string') {
    throw new Error(`The type of the "token" was not string: "${typeof token}"`)
  }

  return _createBot(token, opts)
}
