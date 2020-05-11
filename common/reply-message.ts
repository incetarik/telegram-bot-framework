import { ExtraEditMessage } from 'telegraf/typings/telegram-types'

/**
 * The reply message settings.
 *
 * @export
 * @interface IReplyMessage
 */
export interface IReplyMessage<TMessage = string, TExtra = ExtraEditMessage> {
  /**
   * The message to send to the user.
   *
   * @type {TMessage}
   * @memberof IReplyMessage
   */
  message: TMessage

  /**
   * The extra of the message which will be sent to the user.
   *
   * @type {TExtra}
   * @memberof IReplyMessage
   */
  extra?: TExtra
}
}

export function isReplyMessage(obj: any): obj is IReplyMessage {
  if (typeof obj !== 'object') { return false }
  if (typeof obj.message !== 'string') { return false }
  return true
}
