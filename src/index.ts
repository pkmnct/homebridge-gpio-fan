import type { API } from 'homebridge';
import { GpioFan } from './accessory'; 

/**
 * This method registers the accessory with Homebridge
 */
export = (api: API) => {
  api.registerAccessory('GpioFan', GpioFan);
}
