module.exports = function(RED) {
    function VegaPulsAir(config) {
      RED.nodes.createNode(this, config);
      const node = this;
  
      const gatewayNode = RED.nodes.getNode(config.gateway);
      node.devEui = config.devEui;
  
      if (!gatewayNode) {
        node.error("Gateway not configured");
        return;
      }

      node.log(`VEGAPULS Air Sensor node initialized for DevEUI: ${node.devEui}`);

      // Listen to MQTT messages from the gateway
      gatewayNode.registerListener((mqttMsg) => {
        try {
          const topicParts = mqttMsg.topic.split('/');
          const devEuiFromTopic = topicParts[3]; // "device/DEVEUI"
          
          if (devEuiFromTopic.toLowerCase() === node.devEui.toLowerCase()) {
            const rawPayload = mqttMsg.payload?.data; // Base64 string

            if (!rawPayload) {
              node.error("No Base64 data found in payload");
              return;
            }

            const hexString = Buffer.from(rawPayload, 'base64').toString('hex');
            const byteArray = Buffer.from(hexString, 'hex');

            // Extract 4 bytes from byte index 1 to 4 and unpack as float (big-endian)
            const value = byteArray.readFloatBE(1);  // equivalent to struct.unpack('>f', ...)

            const unitByte = byteArray[5];
            const batteryPercent = byteArray[7];

            const result = {};
            result.value = unitByte === 45 ? Math.round(value * 1000) : value;
            result.battery = batteryPercent;
            result.devEui = node.devEui;
            result.rssi = mqttMsg.payload?.rxInfo[0].rssi;

            node.send({  topic: `sensor/${node.devEui}/level`, payload: result });
          // node.log(JSON.stringify(mqttMsg.payload))
          // const devEui = mqttMsg.payload?.devEui;
          // if (devEui && devEui === node.devEui) {
          //   const level = mqttMsg.payload?.object?.level;
          //   node.send({
          //     topic: `sensor/${devEui}/level`,
          //     payload: {
          //       level: level,
          //       timestamp: mqttMsg.payload?.rxInfo?.[0]?.time
          //     },
          //     devEui: devEui
          //   });
            node.status({ fill: "green", shape: "dot", text: `Level: ${result.value}` });
          }
        } catch (err) {
          node.error("Error processing message: " + err.message);
        }
      });
  
      node.on('input', (msg, send, done) => {
        const ch = msg.channel;
        const value = msg.payload;

        if (typeof ch !== 'number' || ch < 0 || ch > 3) {
          node.error(`Invalid channel: ${ch}`, msg);
          if (done) done();
          return;
        }

        node.channelValues[ch] = value;

        // Log or send to serial/gateway here
        node.status({ fill: "green", shape: "dot", text: `CH${ch}: ${value}` });
  
        const command = {
          payload: value,
          channel: ch,
          moduleId: moduleId,
        };

        node.log(`Analog Output Command ${JSON.stringify(command)}`);

        gatewayNode.sendCommand(command);

        command.topic = `${moduleId}/channel/${ch}`,
        send(command)

        if (done) done();
      });
  
      node.on('close', () => {
        node.status({});
      });
    }
  
    RED.nodes.registerType("vega-puls-air", VegaPulsAir);
  };
  