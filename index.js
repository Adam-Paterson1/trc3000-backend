const express = require('express')
const app = express()
const path = require('path')
const Controller = require('./controller');
const spawn     = require('child_process').spawn;
const pigpio = require('pigpio');
pigpio.configureClock(2, pigpio.CLOCK_PCM);
const Motor = require('./motor');
const cv = require('opencv4nodejs');

const timerPeriod = 100;
const imagePeriod = 80;

const ml = new Motor([2,3], [20, 21]);
// const mr = new Motor([20, 21], [2,3]);

const cl = new Controller();
const cr = new Controller();

app.use(express.static(path.join(__dirname, '../trc3000-frontend/build')))
const server = require('http').createServer(app);
const io = require('socket.io')(server);

let imgStream;

io.on('connection', (client) => {
  let tiltInterval;
  client.on('subscribeToTilt', () => {
    console.log('client is subscribing to tilt with interval 30fps');
    tiltInterval = setInterval(() => {
      ml.calcRpm(timerPeriod);
      let error = cl.run(ml.rpm)
      ml.pwm += error;
      ml.pwm = Math.round(ml.pwm);
      if (ml.pwm < 10) {
        ml.pwm = 10;
      }
      if (ml.pwm > 220) {
        ml.pwm = 220;
      }
      client.emit('tilt', {leftRPM: ml.rpm, leftErr: error, leftPWM: ml.pwm})
      ml.pwmWrite();
    }, timerPeriod)
  });
  client.on('subscribeToImage', () => {
    console.log('subbing to vid');
    imgStream = spawn('raspistill', ['-t', '50000', '-tl', imagePeriod, '-n', '-o', '/home/pi/Desktop/fake/some.jpg', '-w', 300, '-h', 300]);
    imgStream.on("exit", function(code){
      console.log("Failure", code);
    });
    let buff;
    let buff2;
    setInterval(() => {
      buff = cv.imread('/home/pi/Desktop/fake/some.jpg');
      buff2 = buff.threshold(200,255, cv.THRESH_BINARY);
      client.emit('image', [cv.imencode('.jpg', buff).toString('base64'), cv.imencode('.jpg', buff2).toString('base64')]);
    }, imagePeriod)

    imgStream.stdout.on('data', (data) => {
     console.log('data', data);
    })
  });
  client.on('disconnect', () => {
    console.log('clearing intervals')
    if (imgStream) {
      imgStream.kill('SIGINT');
    }
    clearInterval(tiltInterval);
  })
  client.on('setTarget', (target) => {
    if (target.leftRPM) {
      cl.target = target.leftRPM;
      client.emit('target', {leftRPM: cl.target})

    } else if (target.rightRPM) {
      cr.target = target.rightRPM;
      client.emit('target', {rightRPM: cr.target})
    }
    console.log('setting target', target)
  })
  client.on('getTarget', () => {
    client.emit('target', cl.target)
  })
  client.on('setGains', (gains) => {
    console.log('gains', gains);

    cl.kp = Number(gains.kp);
    cr.kp = Number(gains.kp);

    cl.ki = Number(gains.ki);
    cr.ki = Number(gains.ki);

    cl.kd = Number(gains.kd);
    cr.kd = Number(gains.kd);

    client.emit('gains', {kp: cl.kp, ki: cl.ki, kd: cl.kd})
   })

  client.on('getGains', () => {
    client.emit('gains', {kp: cl.kp, ki: cl.ki, kd: cl.kd})
  })

});

server.listen(5000);

 global.log = function(value) {
  io.emit('log', value);
}