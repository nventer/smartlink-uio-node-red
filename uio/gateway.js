const { SerialPort } = require('serialport')
const { ReadlineParser } = require('@serialport/parser-readline')
const mqtt = require('mqtt');
const net = require('net');
const modbus = require('jsmodbus');
const { registerSensor, writeSensorToRegisters } = require('./modbus-mapper');
const { EventBus, logInfo } = require('@smartlink/common');

const modbusServers = {};


module.exports = function(RED) {
  function GatewayNode(config) {
    RED.nodes.createNode(this, config);

    const node = this;

    node.log(JSON.stringify(config))

    const mapperNode = RED.nodes.getNode(config.mapper);

    if (mapperNode) {
      registerSensor(mapperNode.devEUI, parseInt(mapperNode.startRegister), mapperNode.dataType);
    }

    // Configuration

    const portPath = config.port || '/dev/ttyAMA1';
    const baudRate = parseInt(config.baudRate) || 115200;
    const modbusEnabled = config.modbusEnabled;
    const modbusPort = parseInt(config.modbusPort) || 8502;
    
    // Open serial port
    const serial = new SerialPort({
      path: portPath,
      baudRate: baudRate,
      autoOpen: false
    });

    const parser = serial.pipe(new ReadlineParser({ delimiter: '\n' }));

    // Create a shared register buffer
    const holdingRegisters = Buffer.alloc(100 * 2); // 100 registers (each 2 bytes)

     // Prevent redeploy from failing
    //  if (modbusServers[modbusPort]) {
    //   node.warn(`Server on port ${modbusPort} already running. Reusing.`);
    //   return;
    // }

    let netServer;

    node.log(modbusEnabled)

    if (modbusEnabled) {
      netServer = new net.Server()

      // Create Modbus TCP server
      const modbusServer = new modbus.server.TCP(netServer, {
        holding: holdingRegisters
        /* Set the buffer options to undefined to use the events */
        /* coils: undefined */
        /* discrete: undefined */
        /* holding: undefined */
        /* input: undefined */
      })
      

      netServer.listen(modbusPort, () => {
        node.log(`Modbus TCP server is running on port ${modbusPort}`);
      });

      modbusServer.on('connection', function (client) {
        node.log('New Connection')
      })

      modbusServers[modbusPort] = netServer;
    }

    // MQTT config
    const mqttHost = config.mqttHost || 'mqtt://localhost';
    const mqttTopic = config.mqttTopic || 'application/+/device/+/event/up';

    const client = mqtt.connect(mqttHost);

    this.listeners = [];
    this.registerListener = (cb) => this.listeners.push(cb);  

    client.on('connect', function () {
      node.log('Connected to MQTT broker');
      client.subscribe(mqttTopic, function (err) {
        if (err) {
          node.error('MQTT subscription error: ' + err.message);
        } else {
          node.log('Subscribed to: ' + mqttTopic);
        }
      });
    });

    client.on('message', function (topic, message) {
      // Handle ChirpStack message
      const payload = message.toString();
      // node.log(payload)
      try {
        const json = JSON.parse(payload);
        node.listeners.forEach(cb => cb({ topic, payload: json }));
        //node.send({ topic, payload: json });
      } catch (err) {
        node.error('Failed to parse MQTT message: ' + err.message);
      }
    });

    client.on('error', function (err) {
      node.error('MQTT error: ' + err.message);
    });

    // Store I/O node subscriptions
    const subscribers = {};

    // Open and monitor serial connection
    serial.open((err) => {
      if (err) {
        node.error(`Error opening serial port: ${err.message}`);
        return;
      }
      node.log(`Serial port ${portPath} opened at ${baudRate}bps`);
    });

    // Handle incoming serial data
    parser.on('data', (data) => {
      node.log(`Received: ${data}`);
      // try {
      //   const message = JSON.parse(data); // Adjust if using binary protocol

      //   const { moduleId, channel, value } = message;

      //   const key = `${moduleId}-${channel}`;
      //   if (subscribers[key]) {
      //     subscribers[key].forEach(callback => callback(value));
      //   }

      // } catch (err) {
      //   node.warn(`Failed to parse incoming data: ${data}`);
      // }
    });

    // Handle input from Node-RED
    // node.on('input', (msg) => {
    //   const payload = msg.payload;

    //   try {
    //     const frame = JSON.stringify(payload) + '\n';
    //     serial.write(frame, (err) => {
    //       if (err) {
    //         node.error(`Write error: ${err.message}`);
    //       } else {
    //         node.log(`Sent: ${frame}`);
    //       }
    //     });
    //   } catch (err) {
    //     node.error('Invalid payload format.');
    //   }
    // });


    node.sendCommand = function(command) {
      const frame = JSON.stringify(command) + '\n';
      node.log(frame)
      serial.write(frame, (err) => {
        if (err) {
          node.error(`Command send error: ${err.message}`);
        }
      });
    };

    EventBus.on('send-command', (command) => {
      const frame = JSON.stringify(command) + '\n';
      logInfo(frame)
      serial.write(frame, (err) => {
        if (err) {
          node.error(`Command send error: ${err.message}`);
        }
      });
    });

    node.on('close', (removed, done) => {
      node.log('Closing Gateway...')
      serial.close();

      if (client.connected) {
        client.end();
      }
      
      if (netServer) {
        netServer.close(() => {
          setTimeout(() => {
            node.log(`Modbus server on port ${modbusPort} released.`);
            delete modbusServers[modbusPort];
            done();
          }, 200);
        });
      } else
        done();
    });
  }

  RED.nodes.registerType('gateway', GatewayNode);
};
