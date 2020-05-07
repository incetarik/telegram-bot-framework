import { ExtraEditMessage } from 'telegraf/typings/telegram-types'

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

export function isReplyMessage(obj: any): obj is IReplyMessage {
  if (typeof obj !== 'object') { return false }
  if (typeof obj.message !== 'string') { return false }
  return true
}
