const { EventBus, logInfo } = require('@smartlink/common');

module.exports = function(RED) {
    function LevelToMaNode(config) {
      RED.nodes.createNode(this, config);
      const node = this;
  
      node.mode = config.mode || 'distance'; // 'distance' or 'level'
      node.unit = config.unit || 'm';
      node.min = parseFloat(config.min) || 0;
      node.max = parseFloat(config.max) || 1;

      function toMeters(value, unit) {
        switch (unit) {
          case 'cm': return value / 100;
          case 'mm': return value / 1000;
          default: return value; // 'm'
        }
      }
  
      node.on('input', (msg, send, done) => {
        let input = parseFloat(msg.payload);
        if (isNaN(input)) {
          node.error('Payload must be a number');
          return;
        }

        let valueForMapping;
        let mA;
        let percent;

        const result = {};

        input = toMeters(input, node.unit);

        result.readingToMeter = input

        if (node.mode === 'distance') {
          valueForMapping = input;
          if (valueForMapping < node.min) valueForMapping = node.min;
          if (valueForMapping > node.max) valueForMapping = node.max;

          result.value = valueForMapping;
          mA = 4 + ((valueForMapping - node.min) / (node.max - node.min)) * 16;

          percent = (valueForMapping / node.max) * 100;

        } else if (node.mode === 'level') {
          const tankHeight = RED.util.evaluateNodeProperty(config.tankHeight, config.tankHeightType || "str", this, msg);     
          const height = parseFloat(tankHeight);

          let level = height - input;
          if (level < 0) level = 0;
          if (level > height) level = height;

          result.value = level;
          mA = 4 + (level / height) * 16;
          percent = (level / height) * 100;

        } else {
          node.error('Invalid mode');
          return;
        }

        // result.unit = node.unit;
        result.percent = Math.round(percent * 100) / 100;
        result.mA = Math.round(mA * 100) / 100;

        node.status({ fill: "green", shape: "dot", text: `${result.mA} mA` });

        // msg.payload = parseFloat(msg.payload.toFixed(2));
        send({payload: result});

        if (done) done();
      });
  
      node.on('close', () => {
        // Optionally perform cleanup
      });
    }
  
    RED.nodes.registerType("level-to-ma", LevelToMaNode);
  };
  