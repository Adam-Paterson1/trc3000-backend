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
    this.enc1.on('alert', (level, tick) => {
      this.currPulses++;
    });
    // Add in state machine in here ie: level = 1, and level for other thing is 0 so double switch
    this.enc2.on('alert', (level, tick) => {
      this.currPulses++;
    });
    // Initial values
    this.currPulses = 0;
    this.rpm = 0;
    this.pwm = 0;
    this.out1.pwmFrequency(20000);
    this.out2.pwmFrequency(20000);
    this.timerPeriod = timerPeriod * 1.667e-5;
    this.controller = controller;
  }

  calcRpm() {
    this.rpm = this.currPulses/pulsesPerTurn / this.timerPeriod;
    this.currPulses = 0;
  }

  pwmWrite(error) {
    if (!isNaN(error)) {
    this.pwm = Math.round(Math.min( Math.max( -120, this.pwm + error), 120));
    if (this.pwm > 0) {
      //console.log('pwm', this.pwm);
      this.out1.pwmWrite(this.pwm);
      this.out2.digitalWrite(0);
    } else {
      //console.log('pwm2', Math.abs(this.pwm));
      this.out2.pwmWrite(Math.abs(this.pwm));
      this.out1.digitalWrite(0);
    }
  }
}

}

module.exports =  Motor