const { spawn } = require('child_process');

const cv = require('opencv4nodejs');

const blue = new cv.Vec(255, 0, 0);
const green = new cv.Vec(0, 255, 0);
const red = new cv.Vec(0, 0, 255);
let colorUpper = new cv.Vec(28, 255, 220);
let colorLower = new cv.Vec(22, 150, 0);

const imagePeriod = 200;
let imgStream, imgInterval, gVideo;

process.on('message', (msg) => {
  switch (msg.type) {
    case 'THRESH':
      handleThresh();
      break;
    case 'HSV':
      handleHSV(msg.data);
      break;
    case 'START':
      handleStart()
      break;
    case 'SUB':
      handleSub();
      break;
    case 'STOP':
      handleStop()
      break;
    default:
      break;
  }
})

const makeHandMask = (img) => {
  const imgHLS = img.cvtColor(cv.COLOR_BGR2HSV);
  const rangeMask = imgHLS.inRange(colorLower, colorUpper);
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


function handleThresh() {
  const mat1 = new cv.Mat(100, 100, cv.CV_8UC3, [colorLower.x, colorLower.y, colorLower.z]);
  const mat2 = new cv.Mat(100, 100, cv.CV_8UC3, [colorUpper.x, colorUpper.y, colorUpper.z]);
  const mat3 = mat1.cvtColor(cv.COLOR_HSV2BGR);
  const mat4 = mat2.cvtColor(cv.COLOR_HSV2BGR);
  const d1 = cv.imencode('.jpg', mat3).toString('base64');
  const d2 = cv.imencode('.jpg', mat4).toString('base64');
  process.send({type: 'THRESH', data: {0: d1, 1: d2, lower: [colorLower.x, colorLower.y, colorLower.z], upper: [colorUpper.x, colorUpper.y, colorUpper.z]} })
}
function handleHSV(data) {
  const lower = data.lower;
  const upper = data.upper;
  if (lower) {
    colorLower = new cv.Vec(Number(lower[0]), Number(lower[1]), Number(lower[2]))
  }
  if (upper) {
    colorUpper = new cv.Vec(Number(upper[0]), Number(upper[1]), Number(upper[2]))
  }
  handleThresh();
}
function handleStart() {
  console.log('turning on camera');
  if (!imgStream) {
  imgStream = spawn('raspistill', ['-t', '0', '-tl', imagePeriod, '-n', '-o', '/home/pi/Desktop/fake/some.jpg', '-w', 300, '-h', 200, '-q', 5, '-bm', '-md' , 1]);
  imgStream.on("data", function(data){
   console.log("Data", data);
  });
  imgStream.on("close", function(code){
   console.log("Close", code);
  });
  imgStream.on("error", function(code){
   console.log("Error", code);
  });
  imgStream.on("exit", function(code){
   console.log("Exit", code);
  });
  }
}
function handleSub() {
  if (!imgInterval) {
  let buff;
  let buff2;
  let M;
  imgInterval = setInterval(() => {
    buff = cv.imread('/home/pi/Desktop/fake/some.jpg');
    const hsvImg = buff.cvtColor(cv.COLOR_BGR2HSV);
    const handMask = makeHandMask(buff);
    const handContour = getHandContour(handMask);
    //const blueMat = new cv.Mat(100, 100, cv.CV_8UC3, [60, 255, 255]);
    //buff2 = buff.copy();
    buff2 = handMask;//buff2.cvtColor(cv.COLOR_HSV2BGR);
    if (handContour) {
      buff.drawContours([handContour], blue, { thickness: 2 });
      M = handContour.moments();
      gVideo = Math.round(M.m10/M.m00);
      //let cy = Math.round(M.m01/M.m00);
      if (isNaN(gVideo)) {
        gVideo = 0;
      }
      process.send({type: 'VIDERR', data: gVideo})
      console.log('cx', gVideo);
    }
    //buff2 = buff.threshold(200,255, cv.THRESH_BINARY);
    process.send({type: 'VID', data: [cv.imencode('.jpg', buff).toString('base64'), cv.imencode('.jpg', buff2).toString('base64')]})
    //client.emit('image', [cv.imencode('.jpg', buff2).toString('base64')]);
    //client.emit('image', [cv.imencode('.jpg', buff).toString('base64'), cv.imencode('.jpg', buff2).toString('base64')]);
  }, imagePeriod);
  }
}
function handleStop() {
  console.log('killing vision');
  if (imgStream) {
    imgStream.kill('SIGINT');
  }
  clearInterval(imgInterval);
}