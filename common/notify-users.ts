import { ExtraEditMessage } from 'telegraf/typings/telegram-types'

export interface INotificationInfo {
  /**
   * The `handlebars` template to add more information.
   * The template has the following predefined values:
   * - `id`: The `id` of the user.
   * - `username`: The `username` of the user.
   * - `epoch`: The epoch in seconds.
   * - `date`: The current date.
   * - `now`: The current date.
   * - `type`: The type of the call.
   * - `name`: The name of the call.
   *
   * ---
   * And the shortcuts of the above ones.
   * - `i`: `id`
   * - `u`: `username`
   * - `d`: `date`
   * - `e`: `epoch`
   * - `t`: `type`
   * - `n`: `name`
   *
   * @type {string}
   * @memberof INotificationInfo
   */
  template: string

  /**
   * The additional object to be used as a source for template.
   *
   * @type {object}
   * @memberof INotificationInfo
   */
  templateSource?: object

  /**
   * The user(s) to be notified. This could be both the user id, or username,
   * or mix of these two.
   *
   * @type {(string | number | (string | number)[])}
   * @memberof INotificationInfo
   */
  notify: string | number | (string | number)[]

  /**
   * Extra styling for the notification object.
   *
   * @type {ExtraEditMessage}
   * @memberof INotificationInfo
   */
  extra?: ExtraEditMessage
}

export function isNotificationInfo(obj: any): obj is INotificationInfo {
  if (typeof obj !== 'object') { return false }
  if (typeof obj.template !== 'string') { return false }
  if (typeof obj.notify === 'string') { return true }
  if (typeof obj.notify === 'number') { return true }
  if (Array.isArray(obj.notify)) { return true }
  return false
}

/**
 * Creates a notification/message to a user with a given template.
 * yield the result immediately to notify users, for example, for unauthorized
 * command calls.
 *
 * @export
 * @param {INotificationInfo} notificationInfo The notification info object.
 * @returns {INotificationInfo} A notification object to yield.
 */
export function makeNotification(notificationInfo: INotificationInfo): INotificationInfo

/**
 * Creates a notification/message with a given template.
 * yield the result immediately to notify users, for example, for unauthorized
 * command calls.
 *
 * @export
 * @param {string} template The `handlebars` template to add more information.
 * The template has the following predefined values:
 * - `id`: The `id` of the user.
 * - `username`: The `username` of the user.
 * - `epoch`: The epoch in seconds.
 * - `date`: The current date.
 * - `now`: The current date.
 * - `type`: The type of the call.
 * - `name`: The name of the call.
 *
 * And the shortcuts of the above ones.
 * - `i`: `id`
 * - `u`: `username`
 * - `d`: `date`
 * - `e`: `epoch`
 * - `t`: `type`
 * - `n`: `name`
 *
 * @param {((string | number | (string | number)[]))} notify The user(s) to be
 * notified. This could be both the user id, or username, or mix of these two.
 *
 * @param {ExtraEditMessage} [extra] Extra styling for the notification object.
 * @returns {INotificationInfo} A notification object to yield.
 */
export function makeNotification(template: string, notify: (string | number | (string | number)[]), extra?: ExtraEditMessage): INotificationInfo
export function makeNotification(info: INotificationInfo): INotificationInfo
export function makeNotification(template: string | INotificationInfo, notify?: (string | number | (string | number)[]), extra?: ExtraEditMessage): INotificationInfo {
  if (isNotificationInfo(template)) {
    return template
  }

  return {
    template: template,
    notify: notify!,
    extra
  }
}
