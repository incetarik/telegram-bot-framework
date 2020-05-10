# 2.1.2
## Added
- Error handling for any case (`hears`, `action`, `command`) by default, only
if `onError` function is found in instance. The error will be re-thrown again
if the function is not found.

---
# 2.1.1
## Added
- `userBlockMessage`, `botBlockMessage`, `blockMessage` properties to decorator
settings object. If the `userBlockMessage` or `botBlockMessage` is empty, then
`blockMessage` will be used instead. Only the related message could be used.
These properties have type of string or a function that akes four parameters
which are `type` of the call, `name` of the call, `id` of the user and optional
`username`.
If the message is a string, and matches a key in translations, the translation
value will be used. If the message is a function, then the function will be
executed with the instance of the class (`this` will refer to class). Hence, if
you don't want to write function there, you could either have external function
or write, for example, `BotClass.prototype.aLogFunction`, since you can reach
the function through the prototype and it will still be called by the instance
of the class.

- Event messages for these blockings.

## Changed
- Translation function `_` now returns `string | undefined`.

---
# 2.1.0
## Added
- `onceForUser`, `onceForUserIn`, `onceForBot`, `onceForBotIn` properties
for both `@hears`, `@command` and `@action` decorator property objects.
These properties can be used to mark the related function to execute only once
ever, or only once in specific interval in seconds.
- `notify(...)` and `input(...)` exported functions for providing `yield` types
and easier access, such as `yield input(...)` so there will be types for it
with documentations of properties.
- `notify(...)` is a function that notifies/sends some message to given user(s)
and takes a template/format string to format it with given several predefined
variables such as `username` and `now` variables. For more information, use
it as `yield notify(...)` and you will see the documentations.

## Fixed
- `@hears` might cause an error if some other properties have initialized in
internal objects.
