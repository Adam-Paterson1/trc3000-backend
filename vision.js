const { spawn } = require('child_process');
const cv = require('opencv4nodejs');
const blue = new cv.Vec(255, 0, 0);

let colorUpper = new cv.Vec(30, 255, 255);
let colorLower = new cv.Vec(18, 80, 30);

const imagePeriod = 75;
let imgStream, imgInterval, gVideo;
let lastArea = 0;

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
const mode = cv.RETR_EXTERNAL;
const method = cv.CHAIN_APPROX_SIMPLE;
const getHandContour = (handMask) => {
  let contours = handMask.findContours(mode, method);
  // largest contour
  contours = contours.filter((contour) => {
    return (contour.area > 10)
  })
  contours.sort((c0, c1) => c1.area - c0.area)
  if (contours[0]) {
    lastArea = contours[0].area;
    console.log('area', contours[0].area)
    return contours[0];
  }
 return null;
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
    imgStream = spawn('raspistill', ['-t', '0', '-tl', imagePeriod, '-n', '-o', '/home/pi/Desktop/fake/some.jpg', '-w', 150, '-h', 70, '-q', 10, '-bm', '-md' , 1, '-ex', 'sports']);
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
  imgInterval = setInterval(() => {
    buff = cv.imread('/home/pi/Desktop/fake/some.jpg');
    const handMask = makeHandMask(buff);
    const handContour = getHandContour(handMask);
    buff2 = handMask;
    if (handContour) {
      buff.drawContours([handContour], blue, { thickness: 2 });
      if (lastArea > 1000) {
        gVideo = 1;
      } else {
        gVideo = 0.2;
      }
    } else {
     if (lastArea > 1000) {
       gVideo = -1;
     } else {
       gVideo = -1;
     }
    }
    process.send({type: 'VIDERR', data: gVideo})
    //console.log('cx', gVideo);
    process.send({type: 'VID', data: [cv.imencode('.jpg', buff).toString('base64'), cv.imencode('.jpg', buff2).toString('base64')]})
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