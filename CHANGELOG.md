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
