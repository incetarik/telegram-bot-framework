/// <reference path="./types.d.ts"/>

export {
  WaitingStates,
  IInputOpts,
  INotificationInfo,
  IReplyMessage,
  makeNotification as notify,
} from './common'

export { IBotSettings } from './create-bot'
export { action, bot, command, hears, help, IBot, start, state } from './decorators'
export { registerLanguage, _ } from './translations'

