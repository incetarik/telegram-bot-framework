# 2.1.3
## Added
- `ISetActionMessage` interface for providing types for state updates.
- `updateAction` or `updateStatus`, the same functionality for updating the
chat action/status by the bot. These function also have second parameter
indicating whether the `yield` should wait or not for 5 seconds.

- `image` response creating function to use it with `yield` to send images back
to the user. This function may have one string that could either be a path
string of a local image or an URL string of an image. If this function has an
object descripting the source of an image and the caption, the caption will
also be set for the image. This function also has array taking overloads, the
array passed to the function may contain any described above, in this case, the
bot will send a gallery/media group to the user. If total count of the images
are more than 10, then the bot will send images 10 by 10 as separate messages
and the rest of the remainings.

- `autoUpdateStatus: boolean` property for `@bot` settings which indicates that
whether the bot should set chat action such as `uploading photo` automatically.
- `IImageReplyMessage` interface for providing types for image responses.

## Changed
- `IReplyMessage` is now generic, taking two parameters of the type of the
message and the type of the `Extra`.

---
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
