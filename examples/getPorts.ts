
import { NodeSerial, serial } from '../src/NodeSerialConnector';

(async function () {
    let filters: SerialPortFilter[] = [{ usbVendorId: 10376 }];

    let ports = await serial.getPorts();

    console.log("available ports", ports);  

    let port = await serial.requestPort({ filters });

    console.log("\nselected port", port);

    ports = await serial.getPorts();

    console.log("\navailable ports", ports);

})();
