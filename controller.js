class Controller {
  constructor() {
    this = {
    target: 0,
    error: 0,
    prevVal: 0,
    kp: 0,
    kd: 0,
    ki: 0,
    }
  }

  run (currVal) {
    let newErr = this.target - currVal;
    let dir = currVal - this.prevVal;
    this.prevVal = currVal;
    return newErr * this.kp + dir * this.kd;
  }

}



module.exports =  Controller