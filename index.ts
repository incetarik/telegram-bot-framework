/// <reference path="./types.d.ts"/>

export {
  WaitingStates,
  IInputOpts,
  INotificationInfo,
  IReplyMessage,
  IImageReplyMessage,
  makeNotification as notify,
  makeInputObject as input,
  makeImageObject as image,
  makeUpdateActionObject as updateAction,
  makeUpdateStatusObject as updateStatus,
  inlineMenu,
  inlineOptions,
} from './common'

export { IBotSettings } from './create-bot'
export { action, bot, command, hears, help, IBot, start, state } from './decorators'
export { registerLanguage, _ } from './translations'

