import { SerialPort as NodeSerialPort } from "serialport"; // Adaptee
import { PortInfo as NodePortInfo } from "@serialport/bindings-cpp";
import { ReadableStream, WritableStream } from "web-streams-polyfill/ponyfill";
import promptSync from 'prompt-sync';

const prompt = promptSync();

class NodeUnderlyingSource implements UnderlyingSource<Uint8Array> {
    constructor(private port_: NodeSerialPort) { }

    async start(_controller: ReadableStreamDefaultController<Uint8Array>) {
        await this.port_.read(0);
    }

    pull(controller: ReadableStreamDefaultController<Uint8Array>) {
        (async () => {
            const onClose = () => {
                controller.error(new Error("The device has been lost."));
            };

            try {
                this.port_.once("close", onClose);

                this.port_.once("data", async (stream: Buffer) => {
                    let data: Buffer | null = stream;
                    let ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
                    controller.enqueue(new Uint8Array(ab));
                    this.port_.removeListener("close", onClose);
                });
            } catch (error) {
                controller.error(error.toString());
            }
        })();
    }
}

class NodeUnderlyingSink implements UnderlyingSink<Uint8Array> {
    constructor(private port_: NodeSerialPort) { }

    write(chunk: Uint8Array, controller: WritableStreamDefaultController) {
        return new Promise<void>((resolve) => {
            this.port_.write(chunk, (err: Error | null) => {
                if (err) controller.error(err);
            });
            this.port_?.drain((err: Error | null) => {
                if (err) controller.error(err);
                resolve();
            });
        });
    }
}

export interface NodeSerial extends Serial {
    /**
     * Returns all available ports filtered by the options.
     * 
     * A special feature dedicated to Node.js.
     * 
     * @param options the port filter
     * @returns 
     */
    listPorts(options?: SerialPortRequestOptions): Promise<NodeSerialPortAdapter[]>;

    /**
     * Returns port by its path.
     * 
     * A special feature dedicated to Node.js.
     * 
     * @param portPath the path to the serial port, e.g. `/dev/ttyUSB0` on Linux or `COM1` on Windows
     * @returns the serial port instance
     */
    findPort(portPath: string): Promise<SerialPort | undefined>;
}


class NodeSerialAdapter extends EventTarget implements NodeSerial {
    onconnect: EventHandler;
    ondisconnect: EventHandler;

    protected selectedPorts: String[] = [];

    async listPorts(options?: SerialPortRequestOptions): Promise<NodeSerialPortAdapter[]> {
        let ports: NodeSerialPortAdapter[] = [];
        let portsInfo = await NodeSerialPort.list();

        for (let info of portsInfo) {
            ports.push(new NodeSerialPortAdapter(info));
        }

        return ports.filter(port => {
            return options?.filters
                ? options.filters.some(filter =>
                    filter.usbVendorId === port.getInfo().usbVendorId &&
                    (!filter.usbProductId || filter.usbProductId === port.getInfo().usbProductId)
                )
                : true;
        });
    }

    async findPort(portPath: string): Promise<SerialPort | undefined> {
        let ports = await this.listPorts();
        return ports.find(port => port.info_.path === portPath);
    }

    /**
     * In a browser: it returns connected ports that the site already has access to.
     * In Node.js: it returns all ports that the user has selected in requestPort();
     * 
     * @returns the list of ports that the user has selected in requestPort();
     */
    async getPorts(): Promise<SerialPort[]> {
        return (await this.listPorts()).filter(port => this.selectedPorts.includes(port.info_.pnpId ?? ""));
    }

    async requestPort(options?: SerialPortRequestOptions): Promise<SerialPort> {
        let ports = await this.listPorts(options);

        console.log("\nPlease select a port.\n------------------------------");

        for (let i = 0; i < ports.length; i++) {
            let port = ports[i];
            let info = port.info_;
            let friendlyName: string | undefined = (info as any).friendlyName;

            if (friendlyName !== undefined)
                console.log(`${i}: ${friendlyName}`);
            else
                console.log(`${i}: ${info.serialNumber} - ${info.manufacturer} (${info.path})`);
        }

        if (ports.length === 0) {
            console.log("(no available ports)");
        }

        console.log("------------------------------");

        if (ports.length === 0) {
            var ans = prompt('Enter "r" to reload the list: ');
        } else if (ports.length === 1) {
            var ans = prompt(`Enter 0 to the port or "r" to reload the list: `);
        } else {
            var ans = prompt(`Enter 0 ~ ${ports.length - 1} to select a port or "r" to reload the list: `);
        }

        if (ans === 'r') {
            return this.requestPort(options);
        } else if (ans !== "" && ports[Number(ans)]) {
            let port = ports[Number(ans)];
            if (port.info_.pnpId !== undefined)
                this.selectedPorts.push(port.info_.pnpId);
            return port;
        }

        throw new Error("No port selected by the user.");
    }
}

export const serial = new NodeSerialAdapter();

export class NodeSerialPortAdapter extends EventTarget implements SerialPort {
    onconnect: EventHandler;
    ondisconnect: EventHandler;

    port_?: NodeSerialPort;
    info_: NodePortInfo;
    readable_: ReadableStream<Uint8Array>;
    writable_: WritableStream<Uint8Array>;

    get readable(): ReadableStream<Uint8Array> {
        if (!this.readable_ && this.port_?.isOpen) {
            this.readable_ = new ReadableStream<Uint8Array>(new NodeUnderlyingSource(this.port_));
        }
        return this.readable_;
    }

    get writable(): WritableStream<Uint8Array> {
        if (!this.writable_ && this.port_?.isOpen) {
            this.writable_ = new WritableStream<Uint8Array>(new NodeUnderlyingSink(this.port_));
        }
        return this.writable_;
    }

    constructor(info: NodePortInfo) {
        super();
        this.info_ = info;
    }

    open(options: SerialOptions): Promise<void> {
        return new Promise((resolve, reject) => {
            this.port_ = new NodeSerialPort({
                path: this.info_.path,
                baudRate: options.baudRate,
                dataBits: options.dataBits as (5 | 6 | 7 | 8),
                stopBits: options.stopBits as (1 | 1.5 | 2),
                parity: options.parity,
                autoOpen: true,
                highWaterMark: options.bufferSize ?? 65536
            }, (err: Error | null) => {
                if (!this.port_) return;

                if (err) {
                    // XXX: Not implemented the following error
                    // DOMException: Failed to execute 'open' on 'SerialPort': The port is already open

                    // (() => this.onconnect ? this.onconnect(null) : null)()

                    reject(err);
                } else {
                    this.dispatchEvent(new Event("connect"));

                    this.port_.on("close", () => this.dispatchEvent(new Event("disconnect")));

                    this.port_.on("close", () => this.dispatchEvent(new Event("error")));

                    resolve();
                }
            });
        });
    }

    async close(): Promise<void> {
        return new Promise((resolve) => {
            if (this.port_) {
                // XXX: Not implemented the following error
                // TypeError: Failed to execute 'close' on 'SerialPort': Cannot cancel a locked stream
                this.readable_ = undefined as any;
                this.writable_ = undefined as any;

                this.port_.close(() => {
                    this.port_ = undefined;
                    resolve();
                });
            } else {
                throw new Error("Failed to execute 'close' on 'SerialPort': The port is already closed.");
            }
        });
    }

    getInfo(): Partial<SerialPortInfo> {
        return {
            serialNumber: this.info_.serialNumber,
            manufacturer: this.info_.manufacturer,
            locationId: this.info_.locationId,
            vendorId: this.info_.vendorId,
            vendor: undefined,
            productId: this.info_.productId,
            product: undefined,
            usbVendorId: Number("0x" + (this.info_.vendorId || "0")),
            usbProductId: Number("0x" + (this.info_.productId || "0"))
        }
    }
}
