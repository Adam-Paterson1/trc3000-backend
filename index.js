const express = require('express')
const app = express()
const path = require('path')

app.use(express.static(path.join(__dirname, '../frontend/build')))

const server = require('http').createServer(app);
const io = require('socket.io')(server);
io.on('connection', (client) => {
  client.on('subscribeToTimer', (interval) => {
    console.log('client is subscribing to timer with interval ', interval);
    setInterval(() => {
      client.emit('timer', new Date());
    }, interval);
  });
});
server.listen(3000);

// app.listen(3000, () => console.log('Example app listening on port 3000!'))