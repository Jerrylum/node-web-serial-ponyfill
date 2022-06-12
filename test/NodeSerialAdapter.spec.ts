import { SerialPort } from "serialport";
import { PortInfo } from "@serialport/bindings-cpp";

import { serial } from "../src";
import { NodeSerialPortAdapter } from "../src/NodeSerialPortAdapter";
import * as NodePrompt from "../src/NodePrompt";

jest.mock('serialport');

const MockSerialPort = jest.mocked(SerialPort, true);

describe('Node Serial', () => {

    const testPortInfo = [
        { path: "a", manufacturer: "b", serialNumber: "c", pnpId: "d", locationId: "e", productId: "321", vendorId: "123", friendlyName: "friendly name" },
        { path: "h", manufacturer: "i", serialNumber: "j", pnpId: "k", locationId: "l", productId: "654", vendorId: "456" },
        { path: "m", manufacturer: "n", serialNumber: "o", pnpId: undefined, locationId: "q", productId: "987", vendorId: "789" }
    ];

    const testSerialPort = testPortInfo.map(info => new NodeSerialPortAdapter(info));

    beforeEach(() => {
        // Clear all instances and calls to constructor and all methods:
        MockSerialPort.mockClear();
    });

    test('listPorts() returns nothing with no option provided', async () => {
        SerialPort.list = jest.fn(async (): Promise<PortInfo[]> => []);

        expect(await serial.listPorts()).toEqual([]);
    });

    test('listPorts() returns all ports with no option provided', async () => {
        SerialPort.list = jest.fn(async (): Promise<PortInfo[]> => testPortInfo);

        expect(await serial.listPorts()).toEqual(testSerialPort);
    });

    test('listPorts() returns nothing with 1 filter', async () => {
        SerialPort.list = jest.fn(async (): Promise<PortInfo[]> => testPortInfo);

        expect(await serial.listPorts({ filters: [{ usbVendorId: 0 }] })).toEqual([]);
    });

    test('listPorts() returns filtered port with 1 filter', async () => {
        SerialPort.list = jest.fn(async (): Promise<PortInfo[]> => testPortInfo);

        let result = await serial.listPorts({ filters: [{ usbVendorId: 291 }] });

        expect(result.length).toEqual(1);
        expect(result[0]).toEqual(testSerialPort[0]);
    });

    test('listPorts() returns filtered ports with 2 filters', async () => {
        SerialPort.list = jest.fn(async (): Promise<PortInfo[]> => testPortInfo);

        let result = await serial.listPorts({ filters: [{ usbVendorId: 291 }, { usbVendorId: 1110, usbProductId: 1620 }] });

        expect(result.length).toEqual(2);
        expect(result[0]).toEqual(testSerialPort[0]);
        expect(result[1]).toEqual(testSerialPort[1]);
    });

    test('findPort() returns nothing', async () => {
        SerialPort.list = jest.fn(async (): Promise<PortInfo[]> => []);

        expect(await serial.findPort("a")).toEqual(undefined);
    });

    test('findPort() returns the correct port', async () => {
        SerialPort.list = jest.fn(async (): Promise<PortInfo[]> => testPortInfo);

        expect(await serial.findPort("h")).toEqual(testSerialPort[1]);
    });

    test('findPort() returns nothing because of wrong path name', async () => {
        SerialPort.list = jest.fn(async (): Promise<PortInfo[]> => testPortInfo);

        expect(await serial.findPort("z")).toEqual(undefined);
    });

    test('getPorts() returns selected ports', async () => {
        SerialPort.list = jest.fn(async (): Promise<PortInfo[]> => testPortInfo);

        const promptMock = jest.spyOn(NodePrompt, "prompt");

        expect(await serial.getPorts()).toEqual([]);

        promptMock.mockResolvedValueOnce("1");
        await serial.requestPort();

        expect(await serial.getPorts()).toEqual([testSerialPort[1]]);
    });

    test('requestPort() returns correct information', async () => {
        SerialPort.list = jest.fn(async (): Promise<PortInfo[]> => testPortInfo);

        // First try

        let promptMock = jest.spyOn(NodePrompt, "prompt");

        promptMock.mockResolvedValueOnce("0");
        expect(await serial.requestPort()).toEqual(testSerialPort[0]);

        promptMock.mockResolvedValueOnce("1");
        expect(await serial.requestPort()).toEqual(testSerialPort[1]);

        promptMock.mockResolvedValueOnce("2");
        expect(await serial.requestPort()).toEqual(testSerialPort[2]);

        promptMock.mockResolvedValueOnce("3");
        await expect(async () => await serial.requestPort()).rejects.toThrow(Error);

        promptMock.mockResolvedValueOnce("r").mockResolvedValueOnce("2");
        expect(await serial.requestPort()).toEqual(testSerialPort[2]);

        // Second try

        SerialPort.list = jest.fn(async (): Promise<PortInfo[]> => []);

        promptMock = jest.spyOn(NodePrompt, "prompt");

        promptMock.mockResolvedValueOnce("0");
        await expect(async () => await serial.requestPort()).rejects.toThrow(Error);

        // Third try

        SerialPort.list = jest.fn(async (): Promise<PortInfo[]> => [testPortInfo[0]]);

        promptMock = jest.spyOn(NodePrompt, "prompt");

        promptMock.mockResolvedValueOnce("0");
        expect(await serial.requestPort()).toEqual(testSerialPort[0]);

        promptMock.mockResolvedValueOnce("1");
        await expect(async () => await serial.requestPort()).rejects.toThrow(Error);
    });

    test('requestPort() throws error when the input is incorrect', async () => {
        SerialPort.list = jest.fn(async (): Promise<PortInfo[]> => testPortInfo);

        const promptMock = jest.spyOn(NodePrompt, "prompt");

        promptMock.mockResolvedValueOnce("3");
        await expect(async () => await serial.requestPort()).rejects.toThrow(Error);

        promptMock.mockResolvedValueOnce("-1");
        await expect(async () => await serial.requestPort()).rejects.toThrow(Error);

        promptMock.mockResolvedValueOnce("");
        await expect(async () => await serial.requestPort()).rejects.toThrow(Error);

        promptMock.mockResolvedValueOnce("a");
        await expect(async () => await serial.requestPort()).rejects.toThrow(Error);
    });
});

