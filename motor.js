const Gpio = require('pigpio').Gpio;

const pulsesPerTurn = 1800;
const toRpm = 900 * 1.667e-5;

class Motor {
  constructor(pwmPins, encoderPins, offsets, gains, controller, dirCorrect) {
    // Setup
    this.out1 = new Gpio(pwmPins[0], {
      mode: Gpio.OUTPUT
    });
    this.out2 = new Gpio(pwmPins[1], {
      mode: Gpio.OUTPUT
    });
    this.enc1 = new Gpio(encoderPins[0], {
      mode: Gpio.INPUT,
      alert: true
    });
    this.enc2 = new Gpio(encoderPins[1], {
      mode: Gpio.INPUT,
      alert: true
    });


    // Initial values
    this.currPulses = 0;
    this.rpm = 0;
    this.pwm = 0;
    this.out1.pwmFrequency(20000);
    this.out2.pwmFrequency(20000);
    this.controller = controller;
    this.fwdOffset = offsets[0];
    this.backOffset = offsets[1];
    this.fwdGain = gains[0];
    this.backGain = gains[1];
    this.levelA = 0;
    this.levelB = 0;
    this.dirCorrect = dirCorrect;
    this.direction = 1;
    this.rpmLowPass = [0, 0, 0];
    this.rpmIndex = 0;
    this.newVal = 0;

    this.enc1.on('alert', (level, tick) => {
      this.currPulses++;
      //Pulses need to be subtracted here if dir swapped?
      //Going forward and sloing down all good
      //Forward - stop - back
      if (this.levelB == 0) {
        //10 -> 00
        if (this.levelA == 1 && level == 0) {
          this.direction = -1;
        } //00 -> 10
        else if (this.levelA == 0 && level == 1) {
          this.direction = 1;
        }
      } else {
        //01 -> 11
        if (this.levelA == 0 && level == 1) {
          this.direction = -1;
        } //11 -> 01
        else if (this.levelA == 1 && level == 0) {
          this.direction = 1;
        }
      }
      this.levelA = level;
    });
    // Add in state machine in here ie: level = 1, and level for other thing is 0 so double switch
    this.enc2.on('alert', (level, tick) => {
      //this.currPulses++;
      this.levelB = level;
    });
  }

  calcRpm(period) {
    this.newVal =this.dirCorrect * this.direction * this.currPulses/(toRpm * period);
    this.rpm = this.rpm - this.rpmLowPass[this.rpmIndex] / 3 + this.newVal/3;
    this.rpmLowPass[this.rpmIndex] = this.newVal;
    this.rpmIndex = (this.rpmIndex + 1) % 3;
    this.currPulses = 0;
  }
  //calcRpm(period) {
  //  this.newVal = this.dirCorrect * this.direction * this.currPulses/(toRpm * period);
  //  //console.log('diff', this.newVal, this.rpm);
  //  if (Math.abs(this.newVal - this.rpm) > 6) {
  //    this.rpm = this.rpm + 6 * Math.sign(this.newVal - this.rpm);
  //  } else {
  //    this.rpm = this.newVal;
  //  }
  //  this.currPulses = 0;
  //}

  pwmWrite(error) {
    if (!isNaN(error)) {
      if (error > 0) {
        error = error * this.fwdGain + this.fwdOffset;
      } else if (error < 0) {
        error = error * this.backGain - this.backOffset;
      }
      this.pwm = Math.round(Math.min( Math.max( -200, error), 200));
      if (this.pwm > 0) {
        //console.log('pwm', this.pwm);
        this.out1.pwmWrite(this.pwm);
        this.out2.digitalWrite(0);
      } else if (this.pwm < 0) {
        //console.log('pwm2', Math.abs(this.pwm));
        this.out2.pwmWrite(Math.abs(this.pwm));
        this.out1.digitalWrite(0);
      } else {
        this.out1.digitalWrite(0);
        this.out2.digitalWrite(0);
      }
    }
  }
}

module.exports = Motor