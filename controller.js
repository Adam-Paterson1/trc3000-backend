class Controller {
  constructor() {
    this.target = 0;
    this.error = 0;
    this.prevErr = 0;
    this.kp = 0;
    this.kd = 0;
    this.ki = 0;
    this.iErr = 0;
    this.maxIErr = 100;
    }
  run (currVal, dt) {
    let pErr = this.target - currVal;
    let dErr = (pErr - this.prevErr)/dt;
    this.iErr = this.iErr + pErr * dt;
    if (Math.abs(this.iErr) > this.maxIErr) {
      this.iErr = Math.sign(this.iErr) * this.maxIErr;
    }
    if (Math.abs(pErr) < 3) {
      this.iErr = 0;
    }
    this.prevErr = pErr;
    return pErr * this.kp + dErr * this.kd + this.ki * this.iErr;
  }

}
module.exports = Controller