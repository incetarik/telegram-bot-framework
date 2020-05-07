import { ExtraEditMessage } from 'telegraf/typings/telegram-types'

export interface INotificationInfo {
  format: string
  notify: string | number | (string | number)[]
  extra?: ExtraEditMessage
}

export function isNotificationInfo(obj: any): obj is INotificationInfo {
  if (typeof obj !== 'object') { return false }
  if (typeof obj.format !== 'string') { return false }
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
 * @param {string} format The `handlebars` format to add more information.
 * The format has the following predefined values:
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
export function makeNotification(format: string, notify: (string | number | (string | number)[]), extra?: ExtraEditMessage): INotificationInfo

export function makeNotification(format: string | INotificationInfo, notify?: (string | number | (string | number)[]), extra?: ExtraEditMessage): INotificationInfo {
if (isNotificationInfo(format)) {
  return format
  }

  return {
    format,
    notify: notify!,
    extra
  }
}
