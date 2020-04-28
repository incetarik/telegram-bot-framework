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
   * Integrates another middlewares to the bot.
   *
   * @param {...Middleware<ContextMessageUpdate>[]} middlewares Middlewares.
   * @memberof IBot
   */
  use?: Middleware<ContextMessageUpdate> | Middleware<ContextMessageUpdate>[]
}

export function createBot(opts: IBotSettings) {
  initEnvironment()
  const bot = new Telegraf(process.env[ opts.tokenEnvName || 'BOT_TOKEN' ] as string, opts)

  bot.use((ctx, next) => {
    if (!ctx.message) { next!(); return }
    if (!ctx.from) { next!(); return }

    WaitingStates.resolveFor(ctx.from.id, ctx.message)
    next!()
  })

  return bot
}
