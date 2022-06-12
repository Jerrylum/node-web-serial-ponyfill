import { SerialPort as UpstreamSerialPort, SerialPortMock as UpstreamSerialPortMock } from "serialport"; // Adaptee
import { PortInfo as UpstreamPortInfo } from "@serialport/bindings-cpp";
import { ReadableStream, WritableStream } from "web-streams-polyfill/ponyfill";
import { NodeSerialPort } from ".";

type AbstractUpstreamSerialPort = UpstreamSerialPort | UpstreamSerialPortMock;

class NodeUnderlyingSource implements UnderlyingSource<Uint8Array> {
    constructor(private port_: AbstractUpstreamSerialPort, private adapter_: NodeSerialPortAdapter) { }


    handleDisconnection(controller: ReadableStreamDefaultController) {
        if (this.adapter_.readable_)
            controller.error(new Error("The device has been lost."));
        else if (!(controller as any)._closeRequested && (controller as any)._controlledReadableStream._state === 'readable')
            // HACK: avoid "The stream is not in a state that permits close" error
            controller.close();
    }

    async start(_controller: ReadableStreamDefaultController) {
        await this.port_.read(0);
    }

    pull(controller: ReadableStreamDefaultController) {
        if (!this.port_.isOpen) {
            this.handleDisconnection(controller);
            return;
        }

        const onClose = () => this.handleDisconnection(controller);

        this.port_.once("close", onClose);

        this.port_.once("data", async (stream: Buffer) => {
            let data: Buffer | null = stream;
            let ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
            controller.enqueue(new Uint8Array(ab));
            this.port_.removeListener("close", onClose);
        });
    }

    cancel() {
        if (!this.port_.isOpen && this.adapter_.readable_) throw new Error("The device has been lost.");
    }
}

class NodeUnderlyingSink implements UnderlyingSink<Uint8Array> {
    constructor(private port_: AbstractUpstreamSerialPort) { }

    write(chunk: Uint8Array) {
        return new Promise<void>((resolve, reject) => {
            if (!this.port_.isOpen) {
                resolve(); // ignored
                return;
            }

            this.port_.write(chunk, (err: Error | null) => {
                if (err) reject(err);
            });
            this.port_.drain((err: Error | null) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

export interface NodeSerialOptions extends SerialOptions {
    upstream?: typeof UpstreamSerialPort | typeof UpstreamSerialPortMock;
}

export class NodeSerialPortAdapter extends EventTarget implements NodeSerialPort {
    onconnect: EventHandler;
    ondisconnect: EventHandler;

    port_?: AbstractUpstreamSerialPort;
    info_: UpstreamPortInfo;
    readable_: ReadableStream<Uint8Array>;
    writable_: WritableStream<Uint8Array>;

    get readable(): ReadableStream<Uint8Array> {
        if (!this.readable_ && this.port_?.isOpen) {
            this.readable_ = new ReadableStream<Uint8Array>(new NodeUnderlyingSource(this.port_, this));
        }
        return this.readable_;
    }

    get writable(): WritableStream<Uint8Array> {
        if (!this.writable_ && this.port_?.isOpen) {
            this.writable_ = new WritableStream<Uint8Array>(new NodeUnderlyingSink(this.port_));
        }
        return this.writable_;
    }

    constructor(info: UpstreamPortInfo) {
        super();
        this.info_ = info;
    }

    open(options: NodeSerialOptions): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.port_) throw new Error("Failed to execute 'open' on 'SerialPort': The port is already open.");

            this.port_ = new (options.upstream || UpstreamSerialPort)({
                path: this.info_.path,
                baudRate: options.baudRate,
                dataBits: options.dataBits as (5 | 6 | 7 | 8),
                stopBits: options.stopBits as (1 | 1.5 | 2),
                autoOpen: true,
                parity: options.parity,
                highWaterMark: options.bufferSize ?? 65536
            }, (err: Error | null) => {
                if (err) {
                    // XXX: Using error message in Node.js instead of following the error message in dom
                    // DOMException: Failed to open serial port.
                    reject(err);
                } else if (this.port_) {
                    this.port_.on("close", this.closePortEvent.bind(this));

                    this.dispatchEvent(new Event("connect"));
                    if (this.onconnect) this.onconnect(new Event("connect"));

                    resolve();
                }
            });
        });
    }

    close(): Promise<void> {
        return new Promise((resolve) => {
            if (!this.port_) throw new Error("Failed to execute 'close' on 'SerialPort': The port is already closed.");

            // XXX: Not implemented the following error
            // TypeError: Failed to execute 'close' on 'SerialPort': Cannot cancel a locked stream
            this.readable_ = undefined as any;
            this.writable_ = undefined as any;

            this.port_.close(() => {
                this.port_ = undefined;
                resolve();
            });
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

    protected closePortEvent() {
        this.dispatchEvent(new Event("disconnect"));
        if (this.ondisconnect) this.ondisconnect(new Event("disconnect"));
    }
}
