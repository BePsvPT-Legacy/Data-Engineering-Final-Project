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
        socket.emit('add', { path, content, md5 })

        log(`File '${path}' has been added`)
      })
    }
  })
  .on('change', (path) => {
    path = local(path, true)

    socket.emit('unlink', { path })

    Fs.readFile(local(path), 'utf8', (err, content) => {
      socket.emit('add', { path, content, md5 })

      log(`File '${path}' has been changed`)
    })
  })
  .on('unlink', path => {
    path = local(path, true)

    let index = ignoreFiles.indexOf(path)

    if (index > -1) {
      ignoreFiles.splice(index, 1)

      return
    }

    socket.emit('unlink', { path })

    log(`File '${path}' has been deleted`)
  })

watcher
  .on('ready', () => {
    ready = true

    log('Initial scan complete. Ready for changes.')
  })
  .on('error', error => {
    log('Error happened', error)
  })

socket.on('index', (serverIndexes) => {
  let renames = {}
  let _localIndexes = localIndexes
  let paths = {server: [], local: []}

  Object.keys(serverIndexes).forEach(md5 => {
    paths.server.push(serverIndexes[md5])
  })

  Object.keys(_localIndexes).forEach(md5 => {
    paths.local.push(_localIndexes[md5].path)

    if (serverIndexes.hasOwnProperty(md5)) {
      if (_localIndexes[md5].path !== serverIndexes[md5]) {
        renames[_localIndexes[md5].path] = serverIndexes[md5]
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

          Fs.rename(next, conflictName(next), err => {
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
    let newPath = localIndexes[md5].path

    if (paths.server.includes(newPath)) {
      ignoreFiles.push(newPath)

      newPath = conflictName(newPath)

      ignoreFiles.push(newPath)

      Fs.rename(local(localIndexes[md5].path), local(newPath), err => {
        if (err) {
          log(err)
        }

        Fs.readFile(local(newPath), 'utf8', (err, content) => {
          socket.emit('add', {
            path: newPath,
            content: content,
            md5: Md5File.sync(local(newPath))
          })

          log(`File '${newPath}' has been added`)
        })
      })
    } else {
      Fs.readFile(local(newPath), 'utf8', (err, content) => {
        socket.emit('add', {
          path: newPath,
          content: content,
          md5: Md5File.sync(local(newPath))
        })

        log(`File '${localIndexes[md5].path}' has been added`)
      })
    }
  })

  let _renames = {intermediate: [], target: []}

  Object.keys(renames).forEach(oldPath => {
    let intermediate = Uuid.v4()

    _renames.intermediate.push({oldPath: oldPath, newPath: intermediate})
    _renames.target.push({oldPath: intermediate, newPath: renames[oldPath]})

    log(`File '${oldPath}' has been renamed to ${renames[oldPath]}`)
  })

  _renames.intermediate.forEach((item) => { socket.emit('rename', item) })
  _renames.target.forEach((item) => { socket.emit('rename', item) })

  Object.keys(serverIndexes).forEach(md5 => {
    socket.emit('download', {
      path: serverIndexes[md5]
    })
  })
})

socket.on('download', data => {
  Fs.writeFile(local(data.path), data.content, 'utf8', (err) => {
    if (err) {
      log(err)
    } else {
      ignoreFiles.push(data.path)

      log(`File '${data.path}' has been downloaded`)
    }
  })
})

socket.on('connect', () => {
  console.log('connect')
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
