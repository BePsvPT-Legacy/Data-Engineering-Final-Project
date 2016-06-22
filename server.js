import fs from 'fs-extra'
import path from 'path'
import express from 'express'
import http from 'http'
import _debug from 'debug'
import Socket from 'socket.io'
import Promise from 'bluebird'
import { indexDir } from './helpers'

const app = express()
const server = http.Server(app)
const io = new Socket(server)
const cloudPath = path.join.bind(path, 'cloud')
const debug = _debug('file-sync:server')

io.on('connection', (socket) => {
  debug('New connection')
  indexDir().then((data) => {
    socket.emit('index', data)
  })

  socket.on('index', () => {
    indexDir().then((data) => {
      socket.emit('index', data)
    })
  })

  socket.on('add', (data) => {
    debug('Add', data.path)
    Promise.fromCallback((cb) => {
      fs.mkdirs(path.dirname(data.path), cb)
    }).then(() => {
      return Promise.fromCallback(
        (cb) => fs.writeFile(path.join('cloud', data.path), data.content, cb)
      )
    }).then(() => {
      debug(data.path, 'writed')
    }).catch((err) => {
      debug('Write error', err)
    })
  })

  socket.on('rename', (data) => {
    debug('Rename', data)
    Promise.fromCallback((cb) => {
      fs.move(data.old, data.new, cb)
    }).then(() => {
       debug(data.old, ' -> ', data.new, ' success')
    }).catch((err) => {
      debug('Rename error', err)
    })
  })

  socket.on('unlink', (data) => {
    debug('Remove', data.path)
    Promise.fromCallback((cb) => {
      fs.unlink(cloudPath(data.path), cb)
    }).then(() => {
       debug(data.path, 'delete')
    }).catch((err) => {
      debug('Delete error', err)
    })
  })

  socket.on('download', ({ path }) => {
    Promise.fromCallback((cb) => fs.readFile(cloudPath(path), 'utf8', cb))
      .then((content) => {
        socket.emit('download', {
          path,
          content
        })
      })
  })
})

server.listen(32123, '0.0.0.0')
debug('Server start')
