const express = require('express')
const app = express()
const path = require('path')
const Controller = require('./controller');
const spawn     = require('child_process').spawn;
const pigpio = require('pigpio');
pigpio.configureClock(2, pigpio.CLOCK_PCM);
const Motor = require('./motor');
const cv = require('opencv4nodejs');

const timerPeriod = 20;
const imagePeriod = 80;

//B is left
const ml = new Motor([19,26], [27, 17]);
const mr = new Motor([16, 20], [23,24]);

const cl = new Controller();
const cr = new Controller();

app.use(express.static(path.join(__dirname, '../trc3000-frontend/build')))
const server = require('http').createServer(app);
const io = require('socket.io')(server);

let imgStream, child, gTilt;

io.on('connection', (client) => {
  let tiltInterval;
  client.on('subscribeToTilt', () => {
    console.log('client is subscribing to tilt with interval 30fps');
  //let time = Date.now();
  //let time2;
    tiltInterval = setInterval(() => {
      //time2 = Date.now()
      //console.log(time2 - time);
      //time = time2;
      ml.calcRpm(timerPeriod);
      mr.calcRpm(timerPeriod);
      let error = cl.run(ml.rpm)
      let error2 = cr.run(mr.rpm)
      mr.pwm += error2
      ml.pwm += error;
      ml.pwm = Math.round(ml.pwm);
      mr.pwm = Math.round(mr.pwm);
      if (ml.pwm < 0) {
        ml.pwm = 10;
      }
      if (ml.pwm > 220) {
        ml.pwm = 220;
      }
      if (mr.pwm < 10) {
        mr.pwm = 10;
      }
      if (mr.pwm > 220) {
        mr.pwm = 220;
      }
//leftRPM: ml.rpm, leftErr: error, leftPWM: ml.pwm
      client.emit('tilt', {Tilt: gTilt, leftRPM: ml.rpm, leftErr: error, leftPWM: ml.pwm, rightRPM: mr.rpm, rightErr: error2, rightPWM: mr.pwm})
      ml.pwmWrite();
      mr.pwmWrite();
    }, timerPeriod)
    //clearInterval(tiltInterval);
  });
  client.on('subscribeToImage', () => {
    console.log('subbing to vid');
    child = spawn('minimu9-ahrs', ['--output', 'euler', '-b', '/dev/i2c-1'], {cwd: '/home/pi/Documents/trc3000/trc3000-backend', shell: true});
    //stdio: ['pipe', 'inherit', 'pipe']
  //let time = Date.now();
  //let time2;
  child.stdout.on('data', function(data) {
      //time2 = Date.now()
      //console.log(time2 - time);
      //time = time2;
      let datastr = parseFloat(data.toString().split(' ').filter(el => el)[1])
      if (datastr > 90) {
         datastr = -180 + datastr
} else if (datastr < -90) {
         datastr = 180 + datastr
} else {
 datastr = -datastr
}
      gTilt = datastr;
      //client.emit('tilt', {Tilt: datastr})

  });

  child.stderr.on('data', function(data) {

      console.log('stderr: ' + data);

      //Here is where the error output goes

  });

  child.on('close', function(code) {

      console.log('closing code: ' + code);

      //Here you can get the exit code of the script

  });





    //imgStream = spawn('raspistill', ['-t', '500000', '-tl', imagePeriod, '-n', '-o', '/home/pi/Desktop/fake/some.jpg', '-w', 300, '-h', 300]);
    //imgStream.on("exit", function(code){
    //  console.log("Failure", code);
    //});
    //let buff;
    //let buff2;
    //setInterval(() => {
    //  buff = cv.imread('/home/pi/Desktop/fake/some.jpg');
    //  buff2 = buff.threshold(200,255, cv.THRESH_BINARY);
    //  client.emit('image', [cv.imencode('.jpg', buff).toString('base64'), cv.imencode('.jpg', buff2).toString('base64')]);
    //}, imagePeriod)

    //imgStream.stdout.on('data', (data) => {
    // console.log('data', data);
    //})
  });
  client.on('disconnect', () => {
    console.log('clearing intervals')
    if (imgStream) {
      imgStream.kill('SIGINT');
    }
    if (child) {
      child.kill('SIGINT');
    }
    clearInterval(tiltInterval);
  })
  client.on('setTarget', (target) => {
    if (target.leftRPM != null) {
      cl.target = target.leftRPM;
      client.emit('target', {leftRPM: cl.target})

    } else if (target.rightRPM != null) {
      cr.target = target.rightRPM;
      client.emit('target', {rightRPM: cr.target})
    } else if (target.Tilt != null) {
      client.emit('target', {Tilt: target.Tilt})
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