import fs from 'fs'
import express from 'express'
import http from 'http'
import Socket from 'socket.io'
import { indexDir } from './helpers'

const app = express()
const server = http.Server(app)
const io = new Socket(server)

io.on('connection', (socket) => {
  console.log('New connection')
  indexDir().then((data) => {
    socket.emit('index', data)
  })

  socket.on('index', () => {
    indexDir().then((data) => {
      socket.emit('index', data)
    })
  })
})

server.listen(32123, '0.0.0.0')
console.log('Server start')
