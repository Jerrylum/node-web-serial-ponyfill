
import { NodeSerial, serial } from '../src/';

(async function () {
    let filters: SerialPortFilter[] = [{ usbVendorId: 10376 }];

    let g: NodeSerial = serial;

    console.log(await serial.listPorts({ filters }));

    let port = await serial.requestPort({ filters });

    port.addEventListener('connect', () => {
        console.log('Event Connected');
    });

    port.addEventListener('disconnect', () => {
        console.log('Event Disconnected');
    });

    port.addEventListener('error', () => {
        console.log('Event Error');
    });

    await port.open({ baudRate: 115200 });

    let reader = port.readable.getReader();
    let writer = port.writable.getWriter();


    setTimeout(async () => {
        await writer.write(Uint8Array.from([201, 54, 184, 71, 86, 34, 0, 96, 252]));
        console.log("Written");
        
    }, 100);
    
    setTimeout(async () => {
        
        while (true) {
            let { value, done } = await reader.read();
            console.log("result", value, done);
            if (done) break;
        }   
    }, 3000);

    
    // setTimeout(async () => {
    //     await reader.cancel();
    //     await writer.close();
    //     await port.close();

    //     console.log("closed");        
    // }, 2000);

    // while (true) {
    //     let { value, done } = await reader.read();
    //     if (done) break;
    //     console.log("result", value);
    // }



    // (async function() {
    //     let data = await port.readable.read();
    //     console.log(data);
    // })();

    // console.log(port);




    // let port: SerialPort = await NavigatorSerial.requestPort({ filters });
    // console.log(port);

    // let ports = await NavigatorSerial.getPorts();
    // console.log(ports);
})();


setInterval(() => {
    console.log('tick');
}, 1000);

