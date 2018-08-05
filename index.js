const express = require('express')
const app = express()
const path = require('path')
const controller = require('./controller');

app.use(express.static(path.join(__dirname, '../trc3000-frontend/build')))

const server = require('http').createServer(app);
const io = require('socket.io')(server);
io.on('connection', (client) => {
  let timerInterval, tiltInterval;
  client.on('subscribeToTimer', (interval) => {
    console.log('client is subscribing to timer with interval ', interval);
    timerInterval = setInterval(() => {
      client.emit('timer', new Date());
    }, interval);
  });
  client.on('subscribeToTilt', () => {
    console.log('client is subscribing to tilt with interval 30fps');
    let i = 1;
    tiltInterval = setInterval(() => {
      client.emit('tilt', controller.run(Math.sin(i * Math.PI/ 500)))
      i++;
    }, 40)
  });
  client.on('disconnect', () => {
    console.log('clearing intervals')
    clearInterval(timerInterval);
    clearInterval(tiltInterval);
  })
  client.on('setTarget', (target) => {
    console.log('setting target', target)
    controller.target = target
    console.log('new target', controller.target)
    client.emit('target', controller.target)
  })
  client.on('getTarget', () => {
    client.emit('target', controller.target)
  })
  client.on('setGains', (gains) => {
    console.log('gains', gains);
    controller.kp = Number(gains.kp);
    controller.ki = Number(gains.ki);
    controller.kd = Number(gains.kd);
    client.emit('gains', {kp: controller.kp, ki: controller.ki, kd: controller.kd})

  })
  client.on('getGains', () => {
    client.emit('gains', {kp: controller.kp, ki: controller.ki, kd: controller.kd})
  })
});
server.listen(5000);

global.log = function(value) {
  io.emit('log', value);
}
setInterval(() => {
  log('howdy')
}, 300)



// app.listen(3000, () => console.log('Example app listening on port 3000!'))