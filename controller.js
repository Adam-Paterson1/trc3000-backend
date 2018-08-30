class Controller {
  constructor() {
    this.target = 0;
    this.error = 0;
    this.prevVal = 0;
    this.kp = 0;
    this.kd = 0;
    this.ki = 0;
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