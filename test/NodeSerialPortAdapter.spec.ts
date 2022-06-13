import { SerialPortMock } from "serialport";

import { NodeSerialOptions, NodeSerialPortAdapter } from "../src/NodeSerialPortAdapter";

function getRandomInt(max: number) {
    return Math.floor(Math.random() * max);
}

describe('Node Serial Port', () => {

    const testPortInfo = { path: "a", manufacturer: "b", serialNumber: "c", pnpId: "d", locationId: "e", productId: "321", vendorId: "123" };

    const testSerialOption: NodeSerialOptions = { baudRate: 115200, dataBits: 8, parity: 'none', stopBits: 1, bufferSize: 1234, upstream: SerialPortMock };

    beforeEach(() => {
        SerialPortMock.binding.createPort('a', { echo: false, record: true, maxReadSize: 50 })
    });

    afterEach(() => {
        SerialPortMock.binding.reset();
    });

    test('Readable and writable are undefined in new Serial Port', async () => {
        let subject = new NodeSerialPortAdapter(testPortInfo);

        expect(subject.readable).toBeUndefined();
        expect(subject.writable).toBeUndefined();
    });

    test('Readable and writable are defined in opened Serial Port', async () => {
        let subject = new NodeSerialPortAdapter(testPortInfo);

        await subject.open(testSerialOption);

        expect(subject.readable).toBeDefined();
        expect(subject.writable).toBeDefined();
    });

    test('Read from the Serial Port', async () => {
        let subject = new NodeSerialPortAdapter(testPortInfo);

        await subject.open(testSerialOption);

        let upstream: SerialPortMock = subject.port_ as SerialPortMock;

        let reader = subject.readable.getReader();
        expect(() => subject.readable.getReader()).toThrow(TypeError); // no second reader, locked

        let expected = new Uint8Array([1, 2, 3, 4, 5]);
        upstream.port?.emitData(Buffer.from(expected));

        let { value: received, done } = await reader.read();
        expect(done).toBeFalsy();
        expect(received).toEqual(expected);

        await subject.close();

        ({ value: received, done } = await reader.read());
        expect(done).toBeTruthy();
        expect(received).toBeUndefined();
    });

    test('Reader can be closed without error', async () => {
        let subject = new NodeSerialPortAdapter(testPortInfo);

        // first try

        await subject.open(testSerialOption);
        let reader = subject.readable.getReader();
        await subject.close();
        await reader.cancel();

        // second try

        await subject.open(testSerialOption);
        reader = subject.readable.getReader();
        await reader.cancel();
        await subject.close();

        // third try

        await subject.open(testSerialOption);
        reader = subject.readable.getReader();
        setTimeout(async () => {
            await reader.cancel();
        }, 300);
        while (true) {
            let { done } = await reader.read();
            if (done) break;
        }
    });

    test('Reader throws error when the Serial Port is lost', async () => {
        let subject = new NodeSerialPortAdapter(testPortInfo);

        await subject.open(testSerialOption);

        let upstream: SerialPortMock = subject.port_ as SerialPortMock;

        let reader = subject.readable.getReader();

        let expected = new Uint8Array([1, 2, 3, 4, 5]);

        upstream.port?.emitData(Buffer.from(expected));
        await new Promise((r) => setTimeout(r, 1));

        subject.port_?.close();

        let { value: received, done } = await reader.read(); // returns last data

        expect(done).toBeFalsy();
        expect(received).toEqual(expected);
        await expect(async () => await reader.read()).rejects.toThrow(Error);
    });

    test('Reader throws error when it is reading data and the Serial Port is lost', async () => {
        let subject = new NodeSerialPortAdapter(testPortInfo);

        await subject.open(testSerialOption);

        let upstream: SerialPortMock = subject.port_ as SerialPortMock;

        let reader = subject.readable.getReader();

        let expected = new Uint8Array([1, 2, 3, 4, 5]);

        let reading = reader.read();

        upstream.port?.emitData(Buffer.from(expected));
        subject.port_?.close();

        await expect(async () => await reading).rejects.toThrow(Error);
        await expect(async () => await reader.read()).rejects.toThrow(Error);
    });

    test('Reader throws error when trying to cancel the reader but the Serial Port is lost', async () => {
        let subject = new NodeSerialPortAdapter(testPortInfo);

        await subject.open(testSerialOption);

        let upstream: SerialPortMock = subject.port_ as SerialPortMock;

        let reader = subject.readable.getReader();

        subject.port_?.close();

        await expect(async () => await reader.cancel()).rejects.toThrow(Error);
    });

    test('Write to the Serial Port', async () => {
        let subject = new NodeSerialPortAdapter(testPortInfo);

        await subject.open(testSerialOption);

        let upstream: SerialPortMock = subject.port_ as SerialPortMock;

        let writer = subject.writable.getWriter();
        expect(() => subject.writable.getWriter()).toThrow(TypeError); // no second writer, locked

        let data = new Uint8Array([1, 2, 3, 4, 5]);
        await writer.write(data);

        let expected = Buffer.from(data);
        let received = upstream.port?.recording;
        expect(received).toEqual(expected);
    });

    test('Writer ignore write data after the Serial Port is closed', async () => {
        let subject = new NodeSerialPortAdapter(testPortInfo);

        await subject.open(testSerialOption);

        let writer = subject.writable.getWriter();

        let data = new Uint8Array([1, 2, 3, 4, 5]);
        let cb = writer.write(data);

        await subject.close();
        await cb;
        await writer.write(data);
    });

    test('open() opens serial port with correct path and options', async () => {
        let subject1 = new NodeSerialPortAdapter(testPortInfo);

        await subject1.open({ ...testSerialOption, bufferSize: undefined });

        expect(subject1.port_?.isOpen).toBeTruthy();

        const expected1 = ({
            path: "a",
            baudRate: 115200,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            autoOpen: true,
            highWaterMark: 65536 // uncommon info
        })

        for (let key in expected1) {
            expect((subject1.port_?.settings as any)[key]).toEqual((expected1 as any)[key]);
        }
    });

    test('open() cannot be used if the port is opened', async () => {
        let subject = new NodeSerialPortAdapter(testPortInfo);

        await subject.open(testSerialOption);

        await expect(async () => await subject.open(testSerialOption)).rejects.toThrow("Failed to execute 'open' on 'SerialPort': The port is already open.");
    });

    test('open() returns an error when trying to open an invalid port', async () => {
        let subject = new NodeSerialPortAdapter(testPortInfo);

        await expect(async () => await subject.open({ baudRate: 115200 })).rejects.toBeTruthy();
    });

    test('close() cannot be used if the port is closed', async () => {
        let subject = new NodeSerialPortAdapter(testPortInfo);

        await subject.open(testSerialOption);
        await subject.close();

        await expect(async () => await subject.close()).rejects.toThrow(Error);
    });

    test('getInfo() returns correct information', async () => {
        const testPortInfo = { path: "a", manufacturer: "b", serialNumber: "c", pnpId: "d", locationId: "e", productId: undefined, vendorId: undefined };

        let subject = new NodeSerialPortAdapter(testPortInfo);

        expect(subject.getInfo()).toEqual({
            serialNumber: "c",
            manufacturer: "b",
            locationId: "e",
            vendorId: undefined,
            vendor: undefined,
            productId: undefined,
            product: undefined,
            usbVendorId: Number(0), // uncommon info
            usbProductId: Number(0), // uncommon info
        });
    });

    test('open() and close() events dispatch', async () => {
        let subject = new NodeSerialPortAdapter(testPortInfo);

        let conn = jest.fn();
        let conn2 = jest.fn();
        let disconn = jest.fn();
        let disconn2 = jest.fn();

        subject.addEventListener('open', conn);
        subject.addEventListener('close', disconn);

        subject.onconnect = conn2;
        subject.ondisconnect = disconn2;

        let count = getRandomInt(10) + 5;

        for (let index = 0; index < count; index++) {
            expect(conn).toHaveBeenCalledTimes(index);
            expect(conn2).toHaveBeenCalledTimes(0);
            expect(disconn).toHaveBeenCalledTimes(index);
            expect(disconn2).toHaveBeenCalledTimes(0);
            await subject.open(testSerialOption);
            expect(conn).toHaveBeenCalledTimes(index + 1);
            expect(conn2).toHaveBeenCalledTimes(0);
            expect(disconn).toHaveBeenCalledTimes(index);
            expect(disconn2).toHaveBeenCalledTimes(0);
            await subject.close();
            expect(conn).toHaveBeenCalledTimes(index + 1);
            expect(conn2).toHaveBeenCalledTimes(0);
            expect(disconn).toHaveBeenCalledTimes(index + 1);
            expect(disconn2).toHaveBeenCalledTimes(0);
        }
    });
});
