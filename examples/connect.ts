
import { serial } from '../src/';

(async function () {
    let filters = [{ usbVendorId: 10376 }];

    let port = await serial.requestPort({ filters });

    port.addEventListener('connect', () => {
        console.log('Event Connected');
    });

    port.addEventListener('disconnect', () => {
        console.log('Event Disconnected');
    });

    await port.open({ baudRate: 115200 });

    let reader = port.readable.getReader();
    let writer = port.writable.getWriter();

    await writer.write(Uint8Array.from([201, 54, 184, 71, 86, 34, 0, 96, 252]));

    console.log("read start");

    setTimeout(async () => {
        await reader.cancel();
        await writer.close();
        await port.close();

        console.log("closed");
    }, 2000);

    while (true) {
        let { value, done } = await reader.read();
        if (done) break;
        console.log("result", value);
    }

    console.log("read finish");
})();
