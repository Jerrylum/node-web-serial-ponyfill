import { NodeSerialAdapter } from "./NodeSerialAdapter";

export interface NodeSerial extends Serial {
    /**
     * Returns all available ports filtered by the options.
     * 
     * A special feature dedicated to Node.js.
     * 
     * @param options the port filter
     * @returns 
     */
    listPorts(options?: SerialPortRequestOptions): Promise<SerialPort[]>;

    /**
     * Returns port by its path.
     * 
     * A special feature dedicated to Node.js.
     * 
     * @param portPath the path to the serial port, e.g. `/dev/ttyUSB0` on Linux or `COM1` on Windows
     * @returns the serial port instance
     */
    findPort(portPath: string): Promise<SerialPort | undefined>;

    getPorts(): Promise<NodeSerialPort[]>;

    requestPort(options?: SerialPortRequestOptions): Promise<NodeSerialPort>;
}

export interface NodeSerialPort extends SerialPort {

}

export const serial: NodeSerial = new NodeSerialAdapter();
