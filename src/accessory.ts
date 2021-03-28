import { API, AccessoryConfig, AccessoryPlugin, Logging, Service, CharacteristicEventTypes, CharacteristicGetCallback, CharacteristicSetCallback, CharacteristicValue } from 'homebridge';
import { Gpio } from 'onoff';

export class GpioFan implements AccessoryPlugin {
  private readonly log: Logging;
  private readonly name: string;

  private readonly fanService: Service;
  private readonly informationService: Service;

  private readonly api: API;
  private readonly manufacturer: string;
  private readonly model: string;

  private readonly id1Pin: Gpio;
  private readonly id2Pin: Gpio;
  private readonly id3Pin: Gpio;
  private readonly id4Pin: Gpio;

  private readonly offPin: Gpio;
  private readonly lowPin: Gpio;
  private readonly mediumPin: Gpio;
  private readonly highPin: Gpio;

  private speed: number;
  private on: boolean;
  private pendingCallback: NodeJS.Timeout | undefined;

  private readonly sendCommand: (command: 'low' | 'medium' | 'high' | 'off', callback: () => void) => void;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.api = api;

    // These should match the placeholders in config.schema.json
    this.name = config.name || 'Gpio Fan';
    this.manufacturer = config.manufacturer || 'Unknown';
    this.model = config.model || 'Unknown';

    this.id1Pin = new Gpio(23, 'out');
    this.id2Pin = new Gpio(24, 'out');
    this.id3Pin = new Gpio(25, 'out');
    this.id4Pin = new Gpio(26, 'out');

    this.offPin = new Gpio(14, 'out');
    this.lowPin = new Gpio(15, 'out');
    this.mediumPin = new Gpio(16, 'out');
    this.highPin = new Gpio(17, 'out');

    this.sendCommand = (command: 'low' | 'medium' | 'high' | 'off', callback: () => void): void => {
      if (this.pendingCallback) {
        clearTimeout(this.pendingCallback);
        // If we were already sending a command, reset all pins first
        this.id1Pin.write(0);
        this.id2Pin.write(0);
        this.id3Pin.write(0);
        this.id4Pin.write(0);
        this.offPin.write(0);
        this.lowPin.write(0);
        this.mediumPin.write(0);
        this.highPin.write(0);
      }

      if (config.id1) {
        this.id1Pin.write(1);
      }
      if (config.id2) {
        this.id2Pin.write(1);
      }
      if (config.id3) {
        this.id3Pin.write(1);
      }
      if (config.id4) {
        this.id4Pin.write(1);
      }

      if (command === 'off') {
        this.on = false;
        this.offPin.write(1);
      } else if (command === 'low') {
        this.lowPin.write(1);
      } else if (command === 'medium') {
        this.mediumPin.write(1);
      } else if (command === 'high') {
        this.highPin.write(1);
      }

      this.pendingCallback = setTimeout(() => {
        this.id1Pin.write(0);
        this.id2Pin.write(0);
        this.id3Pin.write(0);
        this.id4Pin.write(0);
        this.offPin.write(0);
        this.lowPin.write(0);
        this.mediumPin.write(0);
        this.highPin.write(0);
        callback();
      }, 2000);
    };

    this.speed = 30;
    this.on = false;

    this.log.debug('GPIO Fan Plugin Loaded');

    this.informationService = new this.api.hap.Service.AccessoryInformation()
      .setCharacteristic(this.api.hap.Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(this.api.hap.Characteristic.Model, this.model);

    // create a new "Fan" service
    this.fanService = new this.api.hap.Service.Fan(this.name);

    // link methods used when getting or setting the state of the service 
    this.fanService.getCharacteristic(this.api.hap.Characteristic.On)
      .on(CharacteristicEventTypes.GET, this.getOnHandler.bind(this))   // bind to getOnHandler method below
      .on(CharacteristicEventTypes.SET, this.setOnHandler.bind(this));  // bind to setOnHandler method below

    this.fanService
      .getCharacteristic(this.api.hap.Characteristic.RotationSpeed)
      .on(CharacteristicEventTypes.GET, this.getRotationSpeed.bind(this))   // bind to getOnHandler method below
      .on(CharacteristicEventTypes.SET, this.setRotationSpeed.bind(this));

    this.fanService.getCharacteristic(this.api.hap.Characteristic.RotationSpeed).setProps({
      minStep: 33,
    });
  }

  /**
   * This must return an array of the services to expose.
   * This method must be named "getServices".
   */
  getServices(): Service[] {
    return [
      this.informationService,
      this.fanService,
    ];
  }

  getOnHandler(callback: CharacteristicGetCallback): void {
    this.log.info('Getting switch state: ' + this.on);

    // the first argument of the callback should be null if there are no errors
    // the second argument contains the current status of the device to return.
    callback(null, this.on);

  }

  setOnHandler(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    this.log.info('Setting switch state to:', value);

    const handleCallback = (): void => callback(null);

    if (value) {
      this.on = true;
      if (this.speed <= 33) {
        this.sendCommand('low', handleCallback);
      } else if (this.speed > 33 && this.speed <= 66) {
        this.sendCommand('medium', handleCallback);
      } else {
        this.sendCommand('high', handleCallback);
      }
    } else {
      this.sendCommand('off', handleCallback);
    }
  }


  getRotationSpeed(callback: CharacteristicGetCallback): void {
    this.log.info('Getting rotation state');

    // the first argument of the callback should be null if there are no errors
    // the second argument contains the current status of the device to return.
    callback(null, this.speed);

  }

  setRotationSpeed(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    this.log.info('Setting rotationSpeed: %s', value);

    const handleCallback = (): void => callback(null);

    if (value > 0) {
      this.speed = value as number;
      if (value <= 33) {
        this.sendCommand('low', handleCallback);
      } else if (value > 33 && value <= 66) {
        this.sendCommand('medium', handleCallback);
      } else {
        this.sendCommand('high', handleCallback);
      }
    } else {
      this.sendCommand('off', handleCallback);
    }
  }
}
