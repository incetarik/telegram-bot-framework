import { compile as templateFunction } from 'handlebars'
import { nanoid } from 'nanoid'
import { ExtraEditMessage } from 'telegraf/typings/telegram-types'
import { IMenu } from 'telegram-inline-menu'

type ButtonsTextState = {
  /**
   * The text of the previous button.
   *
   * @type {string}
   */
  prevButtonText?: string

  /**
   * The text of the next button.
   *
   * @type {string}
   */
  nextButtonText?: string

  /**
   * The text of the close button.
   *
   * @type {string}
   */
  closeButtonText?: string
}

interface IInlineOptionStatus extends Required<ButtonsTextState> {
  /**
   * The end index of the source slice starting from 1.
   *
   * @type {number}
   * @memberof IInlineOptionStatus
   */
  to: number

  /**
   * The start index of the source slice starting from 1.
   *
   * @type {number}
   * @memberof IInlineOptionStatus
   */
  from: number

  /**
   * The index of the page.
   *
   * @type {number}
   * @memberof IInlineOptionStatus
   */
  pageIndex: number

  /**
   * The current page number.
   *
   * @type {number}
   * @memberof IInlineOptionStatus
   */
  pageNumber: number

  /**
   * The start index of the source slice.
   *
   * @type {number}
   * @memberof IInlineOptionStatus
   */
  fromIndex: number

  /**
   * The end index of the source slice.
   *
   * @type {number}
   * @memberof IInlineOptionStatus
   */
  toIndex: number

  /**
   * The total item count of the source.
   *
   * @type {number}
   * @memberof IInlineOptionStatus
   */
  readonly itemCount: number

  /**
   * The size of the page which is the number of buttons the page may have
   * at most at once.
   *
   * @type {number}
   * @memberof IInlineOptionStatus
   */
  readonly pageSize: number

  /**
   * The total page count of the source.
   *
   * @type {number}
   * @memberof IInlineOptionStatus
   */
  readonly pageCount: number
}

interface IInlineOptionOpts<T = any> {
  /**
   * The list of the source.
   *
   * @type {T[]}
   * @memberof IInlineOptionOpts
   */
  list?: T[]

  /**
   * The handlebars template of the message to be shown. This string will be
   * shown as the message of the buttons.
   *
   * Available variables:
   * - `nextButtonText`: The text of the next button.
   * - `prevButtonText`: The text of the previous button.
   * - `closeButtonText`: The text of the close button.
   *
   * ---
   *
   * - `to`: The same with `toIndex + 1` unless the `toIndex` exceeds the
   * maximum number of items, in that case, the total number of elements will
   * be shown.
   *
   * - `from`: The same with `fromIndex + 1`.
   *
   * - `fromIndex`: The start index of the source slice.
   * - `toIndex`: The end index of the source slice.
   * ---
   *
   * - `pageIndex`: The index of the page.
   * - `pageSize`: The number of items to be shown in the list.
   * - `pageCount`: The total number of the pages.
   * - `pageNumber`: The same with `pageIndex + 1`.
   * - `itemCount`: The number of elements in the source.
   *
   * `Choose option` by default.
   *
   * @memberof IInlineOptionOpts
   */
  template?: string | ((opts: IInlineOptionStatus) => string | Promise<string>)

  /**
   * The extras of the template message.
   *
   * @type {ExtraEditMessage}
   * @memberof IInlineOptionOpts
   */
  extra?: ExtraEditMessage

  /**
   * The number of buttons to be visible to the user excluding navigation.
   *
   * `5` by default.
   * @type {number}
   * @memberof IInlineOptionOpts
   */
  pageSize?: number

  /**
   * The text of the next button.
   *
   * `'➡️'` by default.
   *
   * @type {string}
   * @memberof IInlineOptionOpts
   */
  nextButtonText?: string

  /**
   * The text of the close button.
   *
   * `'❌'` by default.
   *
   * @type {string}
   * @memberof IInlineOptionOpts
   */
  closeButtonText?: string

  /**
   * Indicates whether to use a close button or not.
   *
   * `true` by default.
   *
   * @type {boolean}
   * @memberof IInlineOptionOpts
   */
  useCloseButton?: boolean

  /**
   * The text of the previous button.
   *
   * `'⬅️'` by default.
   *
   * @type {string}
   * @memberof IInlineOptionOpts
   */
  prevButtonText?: string

  /**
   * The timeout value in milliseconds for each page.
   * If the user do not respond in given time, the function will rjeect.
   *
   * @type {number}
   * @memberof IInlineOptionOpts
   */
  pageTimeout?: number

  /**
   * The timeout value in milliseconds for the whole menu.
   * If the user do not choose any option in given menu in given time, then
   * the function will reject.
   *
   * @type {number}
   * @memberof IInlineOptionOpts
   */
  menuTimeout?: number

  /**
   * Indicates whether the menu should be closed/dismissed when the timeout
   * occurs.
   *
   * `true` by default.
   *
   * When this value is set to `false` an error will be thrown that could be
   * caught by the error handler function of the bot.
   *
   * @type {boolean}
   * @memberof IInlineOptionOpts
   */
  closeOnTimeout?: boolean

  /**
   * The message to be sent to user when the timeout occurs.
   *
   * @type {string}
   * @memberof IInlineOptionOpts
   */
  timeoutMessage?: string

  /**
   * Function that returns the new texts of the navigation buttons.
   *
   * It is possible to return only some of the button texts to update.
   *
   * @memberof IInlineOptionOpts
   */
  buttonsTextGetter?: (opts: Readonly<IInlineOptionStatus>) => ButtonsTextState | Promise<ButtonsTextState>

  /**
   * The handler function to be executed when an item is selected.
   *
   * Set this function is you are not expecting the selected option as a value
   * yielded from this such as given in the example.
   *
   * If this function is set, then the menu will **NOT** be blocking.
   *
   * @example
   * ```ts
   * const result = yield inlineOption(source, 'Choose one')
   * // The following would not be executed if the user do not choose any
   * // option.
   * console.log(result)
   * ```
   *
   * @example
   * ```ts
   * yield inlineOption(source, {
   *   template: 'Choose one',
   *   onSelected(item) {
   *     console.log(item)
   *   }
   * })
   *
   * // Here will be executed immediately after the menu is shown
   * ```
   *
   * @memberof IInlineOptionOpts
   */
  onSelected?(item: T): { message?: string } | void | undefined
}

/**
 * Creates an inline option information object to send user an inline menu
 * containing the items of the given list parameter and the template for the
 * message text.
 *
 * **NOTE**: `.toString()` function will be called for your objects in the list.
 *
 * For the template, there are several variables available for rendering dynamic
 * messages for each navigation.
 *
 * Available variables:
 * - `nextButtonText`: The text of the next button.
 * - `prevButtonText`: The text of the previous button.
 * - `closeButtonText`: The text of the close button.
 *
 * ---
 *
 * - `to`: The same with `toIndex + 1` unless the `toIndex` exceeds the
 * maximum number of items, in that case, the total number of elements will
 * be shown.
 *
 * - `from`: The same with `fromIndex + 1`.
 *
 * - `fromIndex`: The start index of the source slice.
 * - `toIndex`: The end index of the source slice.
 * ---
 *
 * - `pageIndex`: The index of the page.
 * - `pageSize`: The number of items to be shown in the list.
 * - `pageCount`: The total number of the pages.
 * - `pageNumber`: The same with `pageIndex + 1`.
 * - `itemCount`: The number of elements in the source.
 *
 *
 * @export
 * @template T The type of the element.
 * @param {T[]} list The source list to render as inline menu buttons.
 * @param {string} template The template of the message.
 * @returns {IInlineOptionsInformation} The inline options information object.
 */
export function inlineOptions<T>(list: T[], template: string): IInlineOptionsInformation<T>;

/**
 * Creates an inline option information object to send user an inline menu
 * containing the items of the given list parameter.
 *
 * **NOTE**: `.toString()` function will be called for your objects in the list.
 *
 * You can specify the other options in the second parameter about the
 * navigation and the pagination and timeout settings.
 *
 * For the template, there are several variables available for rendering dynamic
 * messages for each navigation, for them, please look for the documentation
 * of the `template` property of the options.
 *
 * @export
 * @template T The type of the element.
 * @param {T[]} list The source list to render as inline menu buttons.
 * @param {IInlineOptionOpts<T>} options The template of the message.
 * @returns {IInlineOptionsInformation} The inline options information object.
 */
export function inlineOptions<T>(list: T[], options: IInlineOptionOpts<T>): IInlineOptionsInformation<T>;

/**
 * Creates an inline option information object to send user an inline menu
 * containing the items of the given list parameter.
 *
 * **NOTE**: `.toString()` function will be called for your objects in the list.
 *
 * For the template, there are several variables available for rendering dynamic
 * messages for each navigation, for them, please look for the documentation
 * of the `template` property of the options.
 *
 * @export
 * @template T The type of the element.
 * @param {IInlineOptionOpts<T>} options The options of the menu and the source.
 * @returns {IInlineOptionsInformation} The inline options information object.
 */
export function inlineOptions<T>(options: IInlineOptionOpts<T>): IInlineOptionsInformation<T>;

export function inlineOptions<T>(
  list: (T[]) | IInlineOptionOpts<T>,
  optsOrTemplate?: string | IInlineOptionOpts<T>
): IInlineOptionsInformation<T> {

  let opts: IInlineOptionOpts<T> | undefined
  if (typeof optsOrTemplate === 'string') {
    opts = { template: optsOrTemplate }
  }
  else {
    opts = optsOrTemplate
  }

  if (Array.isArray(list)) {
    if (opts) {
      opts.list = list
    }
    else {
      opts = { list }
    }
  }
  else if (typeof list !== 'object' || typeof opts !== 'object') {
    throw new Error('The options should be an array or optiosn object')
  }

  const {
    list: source,
    pageSize = 5,
    buttonsTextGetter,
    closeOnTimeout = true,
    useCloseButton = true,

    pageTimeout,
    menuTimeout,
    timeoutMessage,
    onSelected,
    extra
  } = opts!

  if (pageSize <= 0) {
    throw new Error(`Given page size was not valid: ${pageSize}`)
  }

  if (typeof pageTimeout === 'number' && pageTimeout <= 0) {
    throw new Error(`Given page timeout was not valid: ${pageTimeout}`)
  }

  if (typeof menuTimeout === 'number' && menuTimeout <= 0) {
    throw new Error(`Given menu timeout was not valid: ${menuTimeout}`)
  }

  let {
    template: _template = 'Choose option',
    nextButtonText: nextText = '➡️',
    prevButtonText: prevText = '⬅️',
    closeButtonText: closeText = '❌'
  } = opts!

  if (typeof _template === 'string') {
    _template = _template.trim()
    if (_template.length === 0) {
      throw new Error(`Given template string was not valid: "${_template}"`)
    }
  }

  nextText = nextText.trim()
  prevText = prevText.trim()
  closeText = closeText.trim()

  if (!nextText || !prevText || !closeText) {
    throw new Error('One of the navigation buttons had empty text')
  }

  const { length: itemCount } = opts.list!
  const pageCount = Math.ceil(itemCount / pageSize)

  let status: IInlineOptionStatus = {
    nextButtonText: nextText,
    prevButtonText: prevText,
    closeButtonText: closeText,

    itemCount,
    pageSize,
    pageCount,

    from: 1,
    fromIndex: 0,

    pageIndex: 0,
    pageNumber: 1,

    toIndex: pageSize,
    to: Math.min(pageSize, itemCount),
  }

  const prevId = nanoid(8)
  const nextId = nanoid(8)
  let closeButtonId: string | undefined
  if (useCloseButton) {
    closeButtonId = nanoid(8)
  }

  let rejected = false
  let pageTimeoutId: NodeJS.Timeout | undefined
  let menuTimeoutId: NodeJS.Timeout | undefined
  function builder(resolver: Func<T>, reject: (e: Error) => void) {
    return async function _builder() {
      if (rejected) { return }
      let template: HandlebarsTemplateDelegate<any>
      if (typeof _template === 'string') {
        template = templateFunction(_template)
      }
      else if (typeof _template === 'function') {
        const templateString = await _template(status)
        if (typeof templateString !== 'string') {
          throw new Error('Menu text builder function did not return a string')
        }

        template = templateFunction(templateString)
      }
      else {
        throw new Error('Given template was not a string or a function')
      }

      let text = template(status)
      text = text.trim()
      if (text.length === 0) {
        throw new Error(`Given template string was not valid: "${text}"`)
      }

      const menu: IMenu = {
        text,
        buttons: {}
      }

      let index = status.fromIndex
      for (let end = Math.min(index + pageSize, source!.length); index < end; ++index) {
        const item = source![ index ]
        if (typeof item === 'undefined' || typeof item === 'function') {
          throw new Error(`Unexpected type of an item in given array: ${typeof item}`)
        }

        const title = String(item)
        menu.buttons[ index ] = {
          text: title,
          full: true,
          onPress() {
            if (pageTimeoutId) { clearTimeout(pageTimeoutId) }
            if (menuTimeoutId) { clearTimeout(menuTimeoutId) }

            if (typeof onSelected === 'function') {
              const result = onSelected(item)
              if (typeof result === 'object') {
                if (typeof result.message === 'string') {
                  return { closeWith: result.message }
                }
              }
            }
            else {
              resolver(item)
            }

            return { close: true }
          },
        }
      }

      if (typeof buttonsTextGetter === 'function') {
        let {
          nextButtonText = nextText,
          prevButtonText = prevText,
          closeButtonText = closeText
        } = await buttonsTextGetter({ ...status })

        nextButtonText = nextButtonText.trim()
        prevButtonText = prevButtonText.trim()
        closeButtonText = closeButtonText.trim()

        if (!nextButtonText) { nextButtonText = nextText }
        if (!prevButtonText) { prevButtonText = prevText }
        if (!closeButtonText) { closeButtonText = closeText }

        nextText = nextButtonText
        prevText = prevButtonText
        closeText = closeButtonText
      }

      menu.buttons[ prevId ] = {
        text: prevText,
        hide: status.pageIndex === 0,
        onPress() {
          status.toIndex -= pageSize
          status.fromIndex -= pageSize

          status.to = status.toIndex
          status.from = status.fromIndex + 1

          --status.pageIndex
          --status.pageNumber

          return { update: true }
        }
      }

      if (useCloseButton) {
        menu.buttons[ closeButtonId! ] = {
          text: closeText,
          onPress() {
            if (pageTimeoutId) { clearTimeout(pageTimeoutId) }
            if (menuTimeoutId) { clearTimeout(menuTimeoutId) }

            resolver()
            return { close: true }
          }
        }
      }

      menu.buttons[ nextId ] = {
        text: nextText,
        hide: index >= source!.length - 1,
        onPress() {
          status.fromIndex += pageSize
          status.toIndex += pageSize

          status.to = Math.min(status.toIndex, itemCount)
          status.from = status.fromIndex + 1

          ++status.pageIndex
          ++status.pageNumber

          return { update: true }
        }
      }

      if (typeof pageTimeout === 'number') {
        if (pageTimeoutId) { clearTimeout(pageTimeoutId) }

        pageTimeoutId = setTimeout(() => {
          reject(new Error('Timeout'))
          rejected = true
        }, pageTimeout)
      }

      if (typeof menuTimeout === 'number' && typeof menuTimeoutId === 'undefined') {
        menuTimeoutId = setTimeout(() => {
          reject(new Error('Timeout'))
          rejected = true
        }, menuTimeout)
      }

      if (typeof onSelected === 'function') {
        resolver()
      }

      return menu
    }
  }

  return {
    inlineMenu: builder,
    closeOnTimeout,
    timeoutMessage,
    onSelected,
    extra,
  }
}

export interface IInlineOptionsInformation<T = any> {
  /**
   * The inline menu.
   *
   * @type {*}
   * @memberof IInlineOptionsInformation
   */
  inlineMenu(resolver: Func<T>, reject: (e: Error) => void): () => Promise<IMenu | undefined>,

  /**
   * Indicates whether the menu should be closed on timeout or not.
   *
   * @type {boolean}
   * @memberof IInlineOptionsInformation
   */
  closeOnTimeout?: boolean

  /**
   * The message to be sent when timeout occurs.
   *
   * @type {string}
   * @memberof IInlineOptionsInformation
   */
  timeoutMessage?: string

  /**
   * A function to be executed when an item is selected.
   *
   * Setting this will make the generator NON-BLOCKING.
   *
   * @type {Function}
   * @memberof IInlineOptionsInformation
   */
  onSelected?: Function

  /**
   * The extras of the template message.
   *
   * @type {ExtraEditMessage}
   * @memberof IInlineOptionsInformation
   */
  extra?: ExtraEditMessage
}
