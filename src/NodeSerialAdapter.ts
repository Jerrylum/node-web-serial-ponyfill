import { SerialPort as UpstreamSerialPort } from "serialport";
import promptSync from 'prompt-sync';

import { NodeSerial } from ".";
import { NodeSerialPortAdapter } from "./NodeSerialPortAdapter";

const prompt = promptSync();

export class NodeSerialAdapter extends EventTarget implements NodeSerial {
    onconnect: EventHandler;
    ondisconnect: EventHandler;

    protected selectedPorts: String[] = [];

    async listPorts(options?: SerialPortRequestOptions): Promise<NodeSerialPortAdapter[]> {
        let ports: NodeSerialPortAdapter[] = [];
        let portsInfo = await UpstreamSerialPort.list();

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