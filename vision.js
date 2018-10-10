const { spawn } = require('child_process');

const cv = require('opencv4nodejs');

const blue = new cv.Vec(255, 0, 0);
const green = new cv.Vec(0, 255, 0);
const red = new cv.Vec(0, 0, 255);
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
const getHandContour = (handMask) => {
  const mode = cv.RETR_EXTERNAL;
  const method = cv.CHAIN_APPROX_SIMPLE;
  let contours = handMask.findContours(mode, method);
  // largest contour
  contours = contours.filter((contour) => {
   return (contour.area > 10)
})
  //contours = contours.filter((contour) => {
  //  const poly = contour.approxPolyDP(0.04 * contour.arcLength(true), true);
  //  return (poly.length <= 4);
    //return (poly.length <= 4 && Orientation(poly))
  //})

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
      //M = handContour.moments();
      if (lastArea > 1000) {
        gVideo = 1;
      } else {
        gVideo = 0.3;
      }
      //gVideo = 1//Math.round(M.m10/M.m00);
      //let cy = Math.round(M.m01/M.m00);
    }
    else {
     if (lastArea > 1000) {
       gVideo = -1;
     } else {
       gVideo = -1;
     }
     //gVideo = -1
    }
      process.send({type: 'VIDERR', data: gVideo})
      console.log('cx', gVideo);
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

let Ymin, Ymax, len, len2, len3, i, midpoint;
let Xa, Xb, XaMax, XaMin, XbMax, XbMin;
function Orientation(points) {
  Ymin = points[0].y;
  Ymax = points[0].y;
  len = points.length;
  for (i = 1; i < len; i++) {
    if (points[i].y > Ymax) {
      Ymax = points[i].y;
    } else if (points[i].y < Ymin) {
      Ymin = points[i].y;
    }
  }
  midpoint = Ymin + ((Ymax-Ymin)/2);
  Xa = [];
  Xb = [];
  for (i = 0; i < len; i++) {
    if (points[i].y < midpoint) {
      Xa.push(points[i].x);
    } else {
      Xb.push(points[i].x);
    }
  }
  XaMin = Xa[0];
  XaMax = Xa[0];
  len2 = Xa.length;
  for (i = 1; i < len2; i++) {
    if (Xa[i] > XaMax) {
      XaMax = Xa[i];
    } else if (Xa[i] < XaMin) {
      XaMin = Xa[i];
    }
  }
  XbMin = Xb[0];
  XbMax = Xb[0];
  len3 = Xb.length;
  for (i = 1; i < len3; i++) {
    if (Xb[i] > XbMax) {
      XbMax = Xb[i];
    } else if (Xb[i] < XbMin) {
      XbMin = Xb[i];
    }
  }
  if((XaMin > XbMin) && (XaMax <= XbMax)){
    console.log("Upright");
    return true;
  } else {
    console.log("Strange Orientation");
    return true;
  }
  //else if((XaMin < XbMin) && (XaMax > XbMax)){
  //  console.log("Upside Down");
  //  return false;
  //}
}