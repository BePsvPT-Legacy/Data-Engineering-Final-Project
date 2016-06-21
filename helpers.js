import glob from 'glob'
import Promise from 'bluebird'
import fromPairs from 'lodash/fromPairs'
import md5File from 'md5-file/promise'

export const indexDir = () => {
  return Promise.fromCallback((cb) => {
    glob('./cloud/**/*', {
      root: './cloud/'
    }, cb)
  }).then((files) => {
    return Promise.props(fromPairs(files.map((file) => [
      file.replace('./cloud/', ''),
      md5File(file)
    ])))
  })
}
