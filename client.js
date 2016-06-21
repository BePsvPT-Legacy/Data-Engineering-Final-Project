import Chokidar from 'chokidar'
import Fs from 'fs'
import Io from 'socket.io-client'
import Md5File from 'md5-file'
import Path from 'path'
import Uuid from 'node-uuid'
import Yargs from 'yargs'

const argv = Yargs.usage('Usage: $0 -s [string] -p [string]').demand(['s','p']).argv

const watcher = Chokidar.watch(argv.p, {
  ignored: /[\/\\]\./, persistent: true
})

const socket = Io.connect(argv.s, {reconnect: true})

const log = console.log.bind(console)

let ready = false
let ignoreFiles = []
let localIndexes = {}

watcher
  .on('add', path => {
    path = local(path, true)

    let index = ignoreFiles.indexOf(path)

    if (index > -1) {
      ignoreFiles.splice(index, 1)

      return
    }

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
    path = local(path, true)

    if (ignoreFiles.indexOf(path) > -1) {
      return
    }

    socket.emit('unlink', {
      path
    })

    log(`File ${path} has been deleted`)
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
  let renames = {}
  let _localIndexes = localIndexes
  let paths = {server: [], local: []}

  Object.keys(serverIndexes).forEach(md5 => {
    paths.server.push(serverIndexes[md5].path)
  })

  Object.keys(_localIndexes).forEach(md5 => {
    paths.local.push(_localIndexes[md5].path)

    if (serverIndexes.hasOwnProperty(md5)) {
      if (_localIndexes[md5].path !== serverIndexes[md5].path) {
        renames[_localIndexes[md5].path] = serverIndexes[md5].path
      }

      delete serverIndexes[md5]
      delete _localIndexes[md5]
    }
  })

  Object.keys(renames).forEach(oldPath => {
    let circle = false

    let next = oldPath

    do {
      let key = next

      next = renames[next]

      if (next === oldPath) {
        circle = true

        break
      }

      if (! renames.hasOwnProperty(next)) {
        if (paths.server.includes(next)) {
          renames[key] = conflictName(next)

          fs.rename(next, conflictName(next), err => {
            if (err) {
              log(err)
            }
          })
        }

        paths.server.splice(paths.server.indexOf(oldPath), 1)

        break
      }
    } while (true)
  })

  Object.keys(_localIndexes).forEach(md5 => {
    Fs.readFile(local(localIndexes[md5].path), 'utf8', (err, content) => {
      socket.emit('add', {
        path: localIndexes[md5].path,
        content: content,
        md5: Md5File.sync(local(localIndexes[md5].path))
      })

      log(`File ${localIndexes[md5].path} has been added`)
    })
  })

  let _renames = {intermediate: [], target: []}

  Object.keys(renames).forEach(oldPath => {
    let intermediate = Uuid.v4()

    _renames.intermediate.push({oldPath: oldPath, newPath: intermediate})
    _renames.target.push({oldPath: intermediate, newPath: renames[oldPath]})
  })

  _renames.intermediate.forEach((item) => { socket.emit('rename', item) })
  _renames.target.forEach((item) => { socket.emit('rename', item) })

  Object.keys(serverIndexes).forEach(md5 => {
    socket.emit('download', {
      path: serverIndexes[md5].path
    })
  })
})

socket.on('download', data => {
  fs.writeFile(data.path, data.content, 'utf8', (err) => {
    if (err) {
      log(err)
    } else {
      ignoreFiles.push(data.path)
    }
  })
})

socket.on('disconnect', () => {
  console.log('disconnect')
})

socket.on('error', (err) => {
  console.log(err)
})

function local (path, reverse = false) {
  if (reverse) {
    return path.substr(path.indexOf('/') + 1)
  }

  return `.${Path.sep}local${Path.sep}${path}`
}

function conflictName (name) {
  let append = `(Conflict-${new Date().getTime()})`
  let dot = name.indexOf('.')

  if (-1 === dot) {
    name = name + append
  } else {
    name = name.slice(0, dot) + append + name.slice(dot)
  }

  return name
}
