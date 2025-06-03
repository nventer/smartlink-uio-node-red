const { EventBus, logInfo } = require('@smartlink/common');

module.exports = function(RED) {
    function AnalogOutNode(config) {
      RED.nodes.createNode(this, config);
      const node = this;
  
      const gatewayNode = RED.nodes.getNode(config.gateway);
      const moduleId = config.moduleId || 'MOD-XXXX';
      node.channelValues = [null, null, null, null]; // Channel 0–3
  
      if (!gatewayNode) {
        node.error("Gateway not configured");
        return;
      }
  
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

        logInfo(`Analog Output Command ${JSON.stringify(command)}`);

        // gatewayNode.sendCommand(command);
        EventBus.emit('send-command', command);

        command.topic = `${moduleId}/channel/${ch}`,
        send(command)

        if (done) done();
      });
  
      node.on('close', () => {
        // Optionally perform cleanup
      });
    }
  
    RED.nodes.registerType("analog-out", AnalogOutNode);
  };
  