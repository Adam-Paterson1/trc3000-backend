const Gpio = require('pigpio').Gpio;

const pulsesPerTurn = 1800

class Motor {
  constructor(pwmPins, encoderPins, timerPeriod, controller) {
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
    this.timerPeriod = timerPeriod * 1.667e-5;
    this.controller = controller;
    this.levelA = 0;
    this.levelB = 0;

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
      this.currPulses++;
      this.levelB = level;
    });

  }

  calcRpm(period) {
    this.rpm = this.currPulses/pulsesPerTurn / (period* 1.667e-5);
    this.currPulses = 0;
  }

  pwmWrite(error) {
    if (!isNaN(error)) {
      // if (error > 0) {
      //   error += 85;
      // } else if (error < 0) {
      //   error -= 85;
      // }
      this.pwm = Math.round(Math.min( Math.max( -220, error), 220));
      if (this.pwm > 0) {
        //console.log('pwm', this.pwm);
        this.out1.pwmWrite(this.pwm);
        this.out2.digitalWrite(0);
      } else if (this.pwm < 0) {
        //console.log('pwm2', Math.abs(this.pwm));`
        this.out2.pwmWrite(Math.abs(this.pwm));
        this.out1.digitalWrite(0);
      } else {
        this.out1.digitalWrite(0);
        this.out2.digitalWrite(0);
      }
  }
}

}

module.exports =  Motor