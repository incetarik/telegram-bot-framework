import {
  ChatAction, ExtraEditMessage, ExtraMediaGroup, ExtraPhoto
} from 'telegraf/typings/telegram-types'

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

export interface ISetActionMessage { action: ChatAction, wait?: boolean }

export interface IImageReplyMessage extends IReplyMessage<
  {
    source: string | string[] | ({ source: string, caption?: string }[]) | ([ string, string ][]),
    caption?: string
  },
  ExtraPhoto | ExtraMediaGroup
> { }

export function isImageReplyMessage(obj: any): obj is IImageReplyMessage {
  if (typeof obj !== 'object') { return false }
  if (typeof obj.message !== 'object') { return false }
  const { source } = obj.message
  if (typeof source !== 'object') {
    if (typeof source !== 'string') {
      return false
    }
  }

  return true
}

/**
 * Creates an image response with given source.
 * The source may be a local file path too.
 *
 * If the source starts with `~/`, then the image will be searched in `cwd()`.
 *
 * @export
 * @param {string} source The source of the image.
 * @param {string} [caption] The caption of the image.
 * @param {ExtraPhoto} [extra] The Extras.
 * @returns {IImageReplyMessage} Image response.
 */
export function makeImageObject(source: string, caption?: string, extra?: ExtraPhoto): IImageReplyMessage

/**
 * Creates a gallery from given sources.
 * The sources should be a valid URL starting with `http://` or `https://`.
 *
 * If the given links are more than 10, then the images will be split
 * at 10 and will be sent as different media groups.
 *
 * @export
 * @param {string[]} sources The array of sources to send.
 * @param {ExtraMediaGroup} [extra] The Extras.
 * @returns {IImageReplyMessage} Gallery response.
 */
export function makeImageObject(sources: string[], extra?: ExtraMediaGroup): IImageReplyMessage

/**
 * Creates an image response from given source object.
 * The source may be a local file path too.
 *
 * If the source starts with `~/`, then the image will be searched in `cwd()`.
 *
 * @export
 * @param {{ source: string, caption?: string }} source The source object of the image.
 * @param {ExtraPhoto} [extra] The Extras.
 * @returns {IImageReplyMessage} Image response.
 */
export function makeImageObject(source: { source: string, caption?: string }, extra?: ExtraPhoto): IImageReplyMessage

/**
 * Creates a gallery response from given source objects array.
 * The sources should be valid URLs starting with `http://` or `https://`.
 *
 * If the given links are more than 10, then the images will be split
 * at 10 and will be sent as different media groups.
 *
 * @export
 * @param {{ source: string, caption?: string }[]} source The source objects array.
 * @param {ExtraMediaGroup} [extra] The Extras.
 * @returns {IImageReplyMessage} Gallery response.
 */
export function makeImageObject(source: { source: string, caption?: string }[], extra?: ExtraMediaGroup): IImageReplyMessage

/**
 * Creates a gallery response from given `[source, description]` pair array.
 * The sources should be valid URLs starting with `http://` or `https://`.
 *
 * If the given links are more then 10, then the images will be split
 * at 10 and will be sent as different media groups.
 *
 * @export
 * @param {string[][]} source The source-description array array.
 * @param {ExtraMediaGroup} [extra] The Extras.
 * @returns {IImageReplyMessage} Gallery response.
 */
export function makeImageObject(source: string[][], extra?: ExtraMediaGroup): IImageReplyMessage
export function makeImageObject(source: any, captionOrExtra?: string | ExtraPhoto | ExtraMediaGroup, extra?: ExtraPhoto | ExtraMediaGroup): IImageReplyMessage {
  if (typeof source === 'string') {
    source = { source }
    if (typeof captionOrExtra === 'string') {
      source[ 'caption' ] = captionOrExtra
    }
    else {
      extra = captionOrExtra
    }
  }
  else if (Array.isArray(source)) {
    return { message: { source }, extra }
  }
  else if (typeof source === 'object') {
    source = [ source ]
    if (typeof captionOrExtra === 'object') {
      extra = captionOrExtra
      captionOrExtra = undefined
    }
  }
  else if (!Array.isArray(source)) {
    throw new Error(`Unexpected type for source: "${typeof source}"`)
  }

  return { message: source, extra }
}

/**
 * Creates a chat-action update message.
 *
 * @export
 * @param {ChatAction} to New chat action to show for 5 seconds.
 * @param {boolean} [wait=false] Indicates whether the `yield` should
 * wait for 5 seconds.
 * @returns {ISetActionMessage} SetActionMessage
 */
export function makeUpdateActionObject(to: ChatAction, wait = false): ISetActionMessage {
  return { action: to, wait }
}

/**
 * Creates a chat-action update message.
 *
 * @export
 * @param {ChatAction} to New chat action to show for 5 seconds.
 * @param {boolean} [wait=false] Indicates whether the `yield` should
 * wait for 5 seconds.
 * @returns {ISetActionMessage} SetActionMessage
 */
export function makeUpdateStatusObject(to: ChatAction, wait = false): ISetActionMessage {
  return { action: to, wait }
}

export function isSetActionMessage(obj: any): obj is ISetActionMessage {
  if (typeof obj !== 'object') { return false }
  if (typeof obj.action !== 'string') { return false }
  return true
}

export function isReplyMessage(obj: any): obj is IReplyMessage {
  if (typeof obj !== 'object') { return false }
  if (typeof obj.message !== 'string') { return false }
  return true
}
