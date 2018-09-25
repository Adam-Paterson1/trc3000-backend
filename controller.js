class Controller {
  constructor() {
    this.target = 0;
    this.error = 0;
    this.prevErr = 0;
    this.kp = 0;
    this.kd = 0;
    this.ki = 0;
    this.iErr = 0;
    }

    // Target 10, currVal 20 prevVal 15
    //curr err -10, prev error -5
    // -10 err, dir = 5
  run (currVal, dt) {
    let pErr = this.target - currVal;
    let dErr = (pErr - this.prevErr)/dt;
    this.iErr = this.iErr + pErr * dt;
    if (Math.abs(pErr) < 3) {
      this.iErr = 0;
    }
    this.prevErr = pErr;
    if (pErr < 0) {
    return -1 *pErr * pErr * this.kp + dErr * this.kd + this.ki * this.iErr;
} else {

    return pErr * pErr * this.kp + dErr * this.kd + this.ki * this.iErr;
}
  }

}



module.exports =  Controller