// Simple in-memory mapping
const sensorRegisterMap = new Map(); // DevEUI -> { startRegister: number, dataType: 'int' | 'float' }

function registerSensor(devEUI, startRegister, dataType = 'int') {
  sensorRegisterMap.set(devEUI, { startRegister, dataType });
}

function getSensorMapping(devEUI) {
  return sensorRegisterMap.get(devEUI);
}

// Write value into Modbus register buffer
function writeSensorToRegisters(buffer, devEUI, value) {
  const mapping = getSensorMapping(devEUI);
  if (!mapping) return false;

  const { startRegister, dataType } = mapping;
  const offset = startRegister * 2; // Each register is 2 bytes

  try {
    switch (dataType) {
      case 'int':
        buffer.writeUInt16BE(Number(value), offset);
        break;
      case 'float':
        const floatBuffer = Buffer.alloc(4);
        floatBuffer.writeFloatBE(parseFloat(value));
        floatBuffer.copy(buffer, offset);
        break;
      case 'bool':
        buffer.writeUInt16BE(value ? 1 : 0, offset);
        break;
      default:
        return false;
    }
    return true;
  } catch (err) {
    console.error(`Failed to write ${value} for ${devEUI}:`, err);
    return false;
  }
}

module.exports = {
  registerSensor,
  getSensorMapping,
  writeSensorToRegisters,
};
