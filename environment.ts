import * as dotenv from 'dotenv'

export function initEnvironment(opts?: dotenv.DotenvConfigOptions) {
  return dotenv.config(opts)
}
