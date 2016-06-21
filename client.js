import Chokidar from 'chokidar'
import Fs from 'fs'
import Io from 'socket.io-client'
import Md5File from 'md5-file'
import Path from 'path'
import Yargs from 'yargs'

const argv = Yargs.usage('Usage: $0 -s [string] -p [string]').demand(['s','p']).argv

const watcher = Chokidar.watch(argv.p, {
  ignored: /[\/\\]\./, persistent: true
})

const socket = Io.connect(argv.s, {reconnect: true})

let local = (path, reverse = false) => {
  if (reverse) {
    return path.substr(path.indexOf('/') + 1)
  }

  return `.${Path.sep}local${Path.sep}${path}`
}

const log = console.log.bind(console)

let ready = false
let localIndexes = {}

watcher
  .on('add', path => {
    path = local(path)

    let md5 = Md5File.sync(local(path))

    if (! ready) {
      localIndexes[md5] = {
        path: path
      }
    } else {
      Fs.readFile(local(path), 'utf8', (err, content) => {
        socket.emit('add', {
          path: path,
          content: content,
          md5: md5
        })

        log(`File ${path} has been added`)
      })
    }
  })
  .on('change', (path) => {
    log('File', path, 'has been changed')
  })
  .on('unlink', path => {
    path = local(path)

    socket.emit('unlink', {
      path
    })

    log(`File ${path} has been added`)
  })

watcher
  .on('ready', () => {
    ready = true

    log('Initial scan complete. Ready for changes.')
  })
  .on('error', error => {
    log('Error happened', error)
  })

socket.on('connect', (serverIndexes = {}) => {
  Object.keys(localIndexes).forEach((md5) => {
    if (serverIndexes.hasOwnProperty(md5)) {
      if (localIndexes[md5].path !== serverIndexes[md5].path) {
        socket.emit('rename', {
          oldPath: serverIndexes[md5].path,
          newPath: localIndexes[md5].path
        })
      }

      delete serverIndexes[md5]
    } else {
      Fs.readFile(local(localIndexes[md5].path), 'utf8', (err, content) => {
        socket.emit('add', {
          path: localIndexes[md5].path,
          content: content,
          md5: Md5File.sync(local(localIndexes[md5].path))
        })

        log(`File ${localIndexes[md5].path} has been added`)
      })
    }
  })

  Object.keys(serverIndexes).forEach(md5 => {
    socket.emit('unlink', {
      path: serverIndexes[md5].path
    })
  })
})

socket.on('disconnect', () => {
  console.log('disconnect')
})

socket.on('error', (err) => {
  console.log(err)
})
