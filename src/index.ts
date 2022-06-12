import { NodeSerialAdapter } from "./NodeSerialAdapter";

export interface NodeSerial extends Serial {
    /**
     * Returns a Promise that resolves with an array of SerialPort objects representing all serial ports connected to
     * the host filtered by the options.
     * 
     * A special feature dedicated to Node.js.
     * 
     * @param options The port filter
     * @returns A Promise that resolves with an array of SerialPort objects.
     */
    listPorts(options?: SerialPortRequestOptions): Promise<SerialPort[]>;

    /**
     * Returns a Promise that resolves with an instance of SerialPort representing the device on the path.
     * 
     * A special feature dedicated to Node.js.
     * 
     * @param portPath The path to the serial port, e.g. `/dev/ttyUSB0` on Linux or `COM1` on Windows
     * @returns A SerialPort objects.
     */
    findPort(portPath: string): Promise<SerialPort | undefined>;

    /**
     * Returns a Promise that resolves with an array of SerialPort objects representing serial ports connected to the 
     * host which the user has selected in requestPort().
     * 
     * @returns A Promise that resolves with an array of SerialPort objects.
     */
    getPorts(): Promise<NodeSerialPort[]>;

    /**
     * Returns a Promise that resolves with an instance of SerialPort representing the device chosen by the user or 
     * rejects if no device was selected.
     * 
     * @param options The port filter
     * @returns A SerialPort objects.
     */
    requestPort(options?: SerialPortRequestOptions): Promise<NodeSerialPort>;
    
    addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean): void;

    dispatchEvent(event: Event): boolean;

    removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void;
}

export interface NodeSerialPort extends SerialPort {
    addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean): void;

    dispatchEvent(event: Event): boolean;

    removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void;
}

export const serial: NodeSerial = new NodeSerialAdapter();
