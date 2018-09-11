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
const imagePeriod = 100;

const cl = new Controller();
const cr = new Controller();
const cTilt = new Controller();
const cBearing = new Controller();
const cVideo = new Controller();

//B is left
const ml = new Motor([19,26], [27, 17], timerPeriod, cl);
const mr = new Motor([16, 20], [23,24], timerPeriod, cr);

app.use(express.static(path.join(__dirname, '../trc3000-frontend/build')))
const server = require('http').createServer(app);
const io = require('socket.io')(server);

let imgStream, child;
let gTilt = 0;
let gBearing = 0;
let gVideo = 0;

io.on('connection', (client) => {
  let tiltInterval;
  client.on('subscribeToTilt', () => {
    console.log('client is subscribing to tilt with interval', timerPeriod);
  //let time = Date.now();
  //let time2;
    // if (!tiltInterval) {
    //   tiltInterval = setInterval(() => {
    //     //time2 = Date.now()
    //     //console.log(time2 - time);
    //     //time = time2;
    //   }, timerPeriod)
    // }

    if (!child) {
      child = spawn('minimu9-ahrs', ['--output', 'euler', '-b', '/dev/i2c-1'], {cwd: '/home/pi/Documents/trc3000/trc3000-backend', shell: true});
      let time1 = Date.now();
      let time2, dt;
      let tiltErr, bearingErr, vidErr;
      let leftErr, rightErr;
      child.stdout.on('data', function(data) {
        //Minimu new reading make timestamp
        time2 = Date.now()
        dt = time2 - time1;
        time1 = time2;

        //Clean it up and get bearing and tilt
        let nums = data.toString().split(' ').filter(el => el);
        gBearing = parseFloat(nums[0]);
        gTilt = parseFloat(nums[1]);
        if (gTilt > 90) {
          gTilt = 180 - gTilt
        } else if (gTilt < -90) {
          gTilt = -180 - gTilt
        }

        //Run all of our controllers
        // Tilt error should be positive if it needs to drive forward and neg for back
        tiltErr = cTilt.run(gTilt, dt);
        // Bearing error should be positive to turn right NOT SET UP YET
        bearingErr = cBearing.run(gBearing, dt);
        // Video error should be positive to turn right NOT SET UP YET maybe make it p squared?
        vidErr = cVideo.run(gVideo, dt);

        //Combine errors currently not doing any weighting
        leftErr = tiltErr + bearingErr + vidErr;
        rightErr = tiltErr - bearingErr - vidErr;

        //ml.pwmWrite(leftErr);
        //mr.pwmWrite(rightErr);
        //Note bearing is being sent as left RPM.
        client.emit('tilt', {Tilt: gTilt, leftRPM: gBearing, leftErr: leftErr, leftPWM: ml.pwm, rightRPM: mr.rpm, rightErr: rightErr, rightPWM: mr.pwm})

      });
      child.stderr.on('data', function(data) {
        console.log('stderr: ' + data);
      });
      child.on('close', function(code) {
        console.log('closing code: ' + code);
      });
    }

  });
  client.on('subscribeToImage', () => {
    console.log('subbing to vid');

    imgStream = spawn('raspistill', ['-t', '500000', '-tl', imagePeriod, '-n', '-o', '/home/pi/Desktop/fake/some.jpg', '-w', 300, '-h', 200]);
    imgStream.on("exit", function(code){
     console.log("Failure", code);
    });
    let buff;
    let buff2;

const skinColorUpper = hue => new cv.Vec(hue, 235, 235);

const skinColorLower = hue => new cv.Vec(hue, 20, 20);
const blue = new cv.Vec(255, 0, 0);

const green = new cv.Vec(0, 255, 0);

const red = new cv.Vec(0, 0, 255);
const makeHandMask = (img) => {

  // filter by skin color

  const imgHLS = img.cvtColor(cv.COLOR_BGR2HSV);

  const rangeMask = imgHLS.inRange(skinColorLower(40), skinColorUpper(80));



  // remove noise

  const blurred = rangeMask.blur(new cv.Size(10, 10));

  const thresholded = blurred.threshold(200, 255, cv.THRESH_BINARY);



  return thresholded;

};

const getHandContour = (handMask) => {

  const mode = cv.RETR_EXTERNAL;

  const method = cv.CHAIN_APPROX_SIMPLE;

  const contours = handMask.findContours(mode, method);

  // largest contour

  return contours.sort((c0, c1) => c1.area - c0.area)[0];

};

    setInterval(() => {
     cv.imreadAsync('/home/pi/Desktop/fake/some.jpg', (err, buff) => {
//const hsvImg = buff.cvtColor(cv.COLOR_BGR2HSV);
     const handMask = makeHandMask(buff);
     const handContour = getHandContour(handMask);
     const blueMat = new cv.Mat(100, 100, cv.CV_8UC3, [60, 255, 255]);
     buff2 = buff.copy();
     buff2 = handMask;//buff2.cvtColor(cv.COLOR_HSV2BGR);
     if (handContour) {
      buff.drawContours(
      [handContour],
      blue,
      { thickness: 2 }
      );
      let M = handContour.moments();
	let cx = Math.round(M.m10/M.m00);
        let cy = Math.round(M.m01/M.m00);
        console.log('cx', cx);
     }
     //buff2 = buff.threshold(200,255, cv.THRESH_BINARY);
     //client.emit('image', [cv.imencode('.jpg', buff2).toString('base64')]);
client.emit('image', [cv.imencode('.jpg', buff).toString('base64'), cv.imencode('.jpg', buff2).toString('base64')]);
});
     
     
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
      cTilt.target = target.Tilt;
      client.emit('target', {Tilt: cTilt.target})
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
    cTilt.kp = Number(gains.kp);

    cl.ki = Number(gains.ki);
    cr.ki = Number(gains.ki);
    cTilt.ki = Number(gains.ki);

    cl.kd = Number(gains.kd);
    cr.kd = Number(gains.kd);
    cTilt.kd = Number(gains.kd);

    client.emit('gains', {kp: cl.kp, ki: cl.ki, kd: cl.kd})
   })

  client.on('getGains', () => {
    client.emit('gains', {kp: cl.kp, ki: cl.ki, kd: cl.kd})
  })
  client.on('stop', () => {
    clearInterval(tiltInterval);
    cl.target = 0;
    cr.target = 0;
    ml.pwm = 0;
    mr.pwm = 0;
    ml.pwmWrite()
    mr.pwmWrite()
    client.emit('target', {leftRPM: cl.target, rightRPM: cr.target, Tilt: 0})
  })

});

server.listen(5000);

 global.log = function(value) {
  io.emit('log', value);
}