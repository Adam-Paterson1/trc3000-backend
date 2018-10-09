class Controller {
  constructor() {
    this.target = 0;
    this.error = 0;
    this.prevErr = 0;
    this.kp = 0;
    this.kd = 0;
    }
  run (currVal, dt) {
    let pErr = this.target - currVal;
    let dErr = (pErr - this.prevErr)/dt;
    this.prevErr = pErr;
    return pErr * this.kp + dErr * this.kd;
  }

}
module.exports = Controller