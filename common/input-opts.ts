import { ExtraEditMessage, Message } from 'telegraf/typings/telegram-types'

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
