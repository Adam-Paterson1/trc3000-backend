const Gpio = require('pigpio').Gpio;


const pulsesPerTurn = 1800

class Motor {
  constructor(pwmPins, encoderPins) {
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
      currPulses++;
    });
    // Add in state machine in here ie: level = 1, and level for other thing is 0 so double switch
    this.enc2.on('alert', (level, tick) => {
      currPulses++;
    });
    // Initial values
    this.currPulses = 0;
    this.rpm = 0;
    this.pwm = 0;
    this.out1.pwmFrequency(20000);
    this.out2.pwmFrequency(20000);
  }

  calcRpm(timerPeriod) {
    this.rpm = this.currPulses/pulsesPerTurn / (timerPeriod * 1.667e-5);
    this.currPulses = 0;
  }
  pwmWrite(pwm) {
    this.pwm = pwm;
    if (pwm > 0) {
      this.out1.pwmWrite(pwm);
      this.out2.digitalWrite(0);
    } else {
      this.out2.pwmWrite(pwm);
      this.out1.digitalWrite(0);

    }
  }
}

module.exports =  Motor