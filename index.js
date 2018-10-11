//Server Stuff
const express = require('express')
const app = express()
const path = require('path')
app.use(express.static(path.join(__dirname, '../trc3000-frontend/build')))
const server = require('http').createServer(app);
const io = require('socket.io')(server);
//Robot Stuff
const Controller = require('./controller');
const { fork, spawn } = require('child_process');
const pigpio = require('pigpio');
//Set sampling period to 2us
pigpio.configureClock(2, pigpio.CLOCK_PCM);
const Motor = require('./motor');
// const uart = require('./uart');
const vision = fork('vision.js');
//Start the picam immediately to give it time to warm up
vision.send({type: 'START'});

const cl = new Controller();
cl.target = 12;
const cr = new Controller();
cr.target = 10;
const cTilt = new Controller();
const gains = {
  kp: 30,
  kd: 900
}
let ready = false;
//B is left
const ml = new Motor([26, 19], [27, 17], [90, 85], [1, 1], cl, 1);
const mr = new Motor([20, 16], [23,24], [95, 87], [1.05, 1.2], cr, -1);

const pid = process.pid;
let minimu;
let gTilt = 0;
let gVideo = 0;
console.log(pid);
let toRT = spawn('chrt', ['-p', '-f', 5, pid])
toRT.on('close', (code) => {
if (code !== 0) {
    console.log(`chrt process exited with code ${code}`);
  }
})

vision.on('message', (msg) => {
  switch (msg.type) {
    case 'THRESH':
      handleThresh(msg.data);
      break;
    case 'VIDERR':
      gVideo = msg.data > 0 ? cl.target * msg.data : cr.target * msg.data
      break;
    case 'VID':
      handleVid(msg.data);
    default:
      break;
  }
})
function handleThresh (data) {
  io.emit('thresh', data )
}
function handleVid (data) {
  io.emit('image', data )
}

io.on('connection', (client) => {
  client.on('subscribeToTilt', () => {
    if (!minimu) {
      minimu = spawn('minimu9-ahrs', ['--output', 'euler', '-b', '/dev/i2c-1'], {cwd: '/home/pi/Documents/trc3000/trc3000-backend', shell: true, detached: true});
      let time1 = Date.now();
      let time2, dt;
      let tiltErr;
      let leftErr, rightErr;
      let nums;
      function noNulls(el) {
        return el
      } 
      minimu.stdout.on('data', function(data) {
       //Clean it up and get bearing and tilt
        nums = data.toString().split(' ').filter(noNulls);
        gTilt = parseFloat(nums[1]);
        if (gTilt > 90) {
          gTilt = 180 - gTilt
        } else if (gTilt < -90) {
          gTilt = -180 - gTilt
        }
        //Minimu new reading make timestamp
        time2 = Date.now()
        dt = time2 - time1;
        time1 = time2;
        if (Math.abs(dt - 10) > 3) {
          console.log(dt)
        }
        //Run all of our controllers
        // Tilt error should be positive if it needs to drive forward and neg for back
        tiltErr = cTilt.run(gTilt, dt);
        ml.calcRpm(dt);
        mr.calcRpm(dt);
        //Combine errors currently not doing any weighting
        leftErr = tiltErr - gVideo - 10;
        rightErr = tiltErr + gVideo - 10;

        const avg = (ml.rpm + mr.rpm) /1.4;
        if (ready) {
          ml.pwmWrite(leftErr + avg);
          mr.pwmWrite(rightErr + avg);
        }
        io.emit('tilt', {Tilt: gTilt, leftRPM: ml.rpm, leftErr: leftErr, leftPWM: ml.pwm, rightRPM: mr.rpm, rightErr: rightErr, rightPWM: mr.pwm})
      });
      minimu.stderr.on('data', function(data) {
        console.log('stderr: ' + data);
      });
      minimu.on('close', function(code) {
        console.log('closing code: ' + code);
      });
    }

  });
  client.on('subscribeToImage', () => {
    console.log('subbing to vid');
    vision.send({type:'SUB'})
  });
  client.on('subscribeToThresh', () => {
    vision.send({type: 'THRESH'})
  });
  client.on('setHSV', (data) => {
    vision.send({type: 'HSV', data: data})
  });

  client.on('disconnect', () => {
    console.log('client disconnected')
  })
  client.on('setTarget', (target) => {
    if (target.leftRPM != null) {
      cl.target = Number(target.leftRPM);
      io.emit('target', {leftRPM: cl.target})
    } else if (target.rightRPM != null) {
      cr.target = Number(target.rightRPM);
      io.emit('target', {rightRPM: cr.target})
    } else if (target.Tilt != null) {
      cTilt.target = Number(target.Tilt);
      io.emit('target', {Tilt: cTilt.target})
    }
    console.log('setting target', target)
  })
  client.on('getTarget', () => {
    io.emit('target', {Tilt: cTilt.target, leftRPM: cl.target, rightRPM: cr.target})
  })
  function setGains (gains) {
    console.log('gains', gains);
    ready = true;
    cTilt.kp = Number(gains.kp);
    cTilt.kd = Number(gains.kd);
    emitGains();
  }
  client.on('setGains', setGains)
  function emitGains() {
    io.emit('gains', {kp: cTilt.kp, kd: cTilt.kd})
  }
  client.on('getGains', emitGains)
  client.on('start', () => {
    cTilt.target = -3.5
    setGains(gains)
  })
  client.on('stop', () => {
    vision.send({type: 'STOP'})
    if (minimu) {
      process.kill(-minimu.pid);
    }
    for (let i=0; i<500; i++) {
      cl.target = 0;
      cr.target = 0;
      ml.pwm = 0;
      mr.pwm = 0;
      ml.pwmWrite(0)
      mr.pwmWrite(0)
      io.emit('target', {leftRPM: cl.target, rightRPM: cr.target, Tilt: 0})
    }
  })
});

server.listen(5000);

global.log = function(value) {
  io.emit('log', value);
}