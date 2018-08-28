const express = require('express')
const app = express()
const path = require('path')
const controller = require('./controller');
const spawn     = require('child_process').spawn;
const NALseparator    = new Buffer([0,0,0,1]);//NAL break
const Splitter        = require('stream-split');
const cv = require('opencv4nodejs');

var streamer;

const pigpio = require('pigpio');
const Gpio = require('pigpio').Gpio;
const timerPeriod = 100;
pigpio.configureClock(2, pigpio.CLOCK_PCM);


const out1 = new Gpio(2, {
  mode: Gpio.OUTPUT
});
const out2 = new Gpio(3, {
  mode: Gpio.OUTPUT
});

out1.pwmFrequency(20000);
let pwm = 80;
out1.pwmWrite(pwm);
out2.digitalWrite(0);

const button = new Gpio(21, {

  mode: Gpio.INPUT,

  alert: true

});

const pulsesPerTurn = 1800
let currPulses = 0;

let speed = 0;
let rpm = 0;
let prevTick = 0;

button.on('alert', (level, tick) => {
  currPulses++;
  //rpm = 1/pulsesPerTurn / ( ((tick >> 0) - (prevTick >> 0)) * 1.667e-8 );
  //console.log(rpm)
  //console.log('hi', level, tick);
  //prevTick = tick;

});
const button2 = new Gpio(20, {

  mode: Gpio.INPUT,

  alert: true

});

button2.on('alert', (level, tick) => {
  currPulses++;
  //rpm = 1/pulsesPerTurn / ( ((tick >> 0) - (prevTick >> 0)) * 1.667e-8 );
  //console.log('hi2', level, tick);
  //prevTick = tick;

});

function calcRpm () {
   rpm = currPulses/pulsesPerTurn / (timerPeriod * 1.667e-5);
   console.log('rpm', rpm);
   currPulses = 0;
}

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
      calcRpm();
      let error = controller.run(rpm)
      pwm += error;
      pwm = Math.round(pwm);
      if (pwm < 10) {
        pwm = 10;
      }
      if (pwm > 220) {
        pwm = 220;
      }
      client.emit('tilt', error)
      console.log(pwm);
      out1.pwmWrite(pwm);
      i++;
    }, timerPeriod)
  });
  client.on('subscribeToVid', () => {
    console.log('subbing to vid');
    const rows = 100; // height
    const cols = 100; // width
    const blueMat = new cv.Mat(rows, cols, cv.CV_8UC3, [255, 0, 0]);
    client.emit('image', blueMat);
    cv.imwrite('blueImage.png', blueMat);

    let m1 = cv.imread('test1.png');
    let thresh = m1.threshold(200, 255, cv.THRESH_BINARY);
    cv.imwrite('test2.png', thresh);
    //cv.imshow('a window name', blueMat);
    streamer = spawn('raspivid', ['-t', '0', '-n', '-o', '-', '-w', 480, '-h', 480, '-fps', 6, '-pf', 'baseline']);
    streamer.on("exit", function(code){
      console.log("Failure", code);
    });
    let stream2 = spawn('raspistill', ['-t', '0', '-n', '-o', '-', '-w', 100, '-h', 100, '-rgb']);
    stream2.on("exit", function(code){
      console.log("Failure", code);
    });
    stream2.stdout.on('data', (data) => {
     console.log('data', data);
    })

    var readStream = streamer.stdout.pipe(new Splitter(NALseparator));
	readStream.on('data', (data) => {
	  client.binary(true).emit('vid', Buffer.concat([NALseparator, data]))
	});
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