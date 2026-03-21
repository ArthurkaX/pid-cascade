// ==========================================
// CONFIG.JS - APPLICATION CONSTANTS
// ==========================================

const CHART_MAX_BUFFER_POINTS = 200000;
const TEST_SETTLED_THRESHOLD = 0.5;
const TEST_SETTLED_DURATION = 15;
const TEST_PHASE_TIMEOUT = { stabilize: 360, product: 180, water: 300, boiler: 90 };
const DEFAULT_TIME_WINDOW = 60;
const DEFAULT_SETPOINT = 72;
const DEFAULT_TEMPS = { product: 20, water: 55 };

const TEST_PHASES = [
    { name: 'Stabilize', inletTemp: 5, timeout: TEST_PHASE_TIMEOUT.stabilize, nextLog: 'Inlet → 5°C (Cold Product)' },
    { name: 'Cold Product 5°C', inletTemp: 15, timeout: TEST_PHASE_TIMEOUT.product, nextLog: 'Inlet → 15°C (Water)' },
    { name: 'Water 15°C', boilerFail: true, timeout: TEST_PHASE_TIMEOUT.water, nextLog: 'Boiler Failure ON' }
];

const PID_FIELD_MAPPINGS = [
    { domKey: 'masterKp', inputKey: 'master_Kp' },
    { domKey: 'masterTi', inputKey: 'master_Ti' },
    { domKey: 'masterTd', inputKey: 'master_Td' },
    { domKey: 'masterC', inputKey: 'master_c' },
    { domKey: 'masterB', inputKey: 'master_b' },
    { domKey: 'masterA', inputKey: 'master_a' },
    { domKey: 'masterOutH', inputKey: 'master_out_h' },
    { domKey: 'masterOutL', inputKey: 'master_out_l' },
    { domKey: 'masterDeadband', inputKey: 'master_Deadband' },
    { domKey: 'masterSP', inputKey: 'master_SP' },
    { domKey: 'slaveKp', inputKey: 'slave_Kp' },
    { domKey: 'slaveTi', inputKey: 'slave_Ti' },
    { domKey: 'slaveTd', inputKey: 'slave_Td' },
    { domKey: 'slaveC', inputKey: 'slave_c' },
    { domKey: 'slaveB', inputKey: 'slave_b' },
    { domKey: 'slaveA', inputKey: 'slave_a' },
    { domKey: 'slaveOutH', inputKey: 'slave_out_h' },
    { domKey: 'slaveOutL', inputKey: 'slave_out_l' },
    { domKey: 'slaveDeadband', inputKey: 'slave_Deadband' },
    { domKey: 'singleKp', inputKey: 'single_Kp' },
    { domKey: 'singleTi', inputKey: 'single_Ti' },
    { domKey: 'singleTd', inputKey: 'single_Td' },
    { domKey: 'singleC', inputKey: 'single_c' },
    { domKey: 'singleB', inputKey: 'single_b' },
    { domKey: 'singleA', inputKey: 'single_a' },
    { domKey: 'singleOutH', inputKey: 'single_out_h' },
    { domKey: 'singleOutL', inputKey: 'single_out_l' },
    { domKey: 'singleDeadband', inputKey: 'single_Deadband' },
    { domKey: 'singleSP', inputKey: 'single_SP' },
    { domKey: 'distValveWear', inputKey: 'dist_ValveWear' },
    { domKey: 'distPressureNoise', inputKey: 'dist_PressureNoise' },
    { domKey: 'distInletTemp', inputKey: 'dist_InletTempSP' },
    { domKey: 'distInletRate', inputKey: 'dist_InletTempRate' },
    { domKey: 'slaveManualSp', inputKey: 'slave_manual_SP' }
];

const DISTURBANCE_VALUE_DISPLAYS = [
    { domKey: 'distValveWear', valueDomKey: 'distValveWearValue', suffix: '%', decimals: 1 },
    { domKey: 'distPressureNoise', valueDomKey: 'distPressureNoiseValue', suffix: '', decimals: 2 }
];

const CHART_VARIABLE_CONFIG = {
    TMilkOutlet: { label: "TT201 (Product Out)", color: "#0055FF", scale: "°C", width: 3 },
    TMilkInlet: { label: "TT202 (Product In)", color: "#6366f1", scale: "°C", width: 3 },
    TWaterAfterSteam: { label: "TT101 (Water)", color: "#008F39", scale: "°C", width: 1.5 },
    Valve: { label: "Y101 (Valve %)", color: "#E68A00", scale: "%", width: 2 },
    ProductSP: { label: "SP (Product)", color: "#CC0000", scale: "°C", dash: [5, 5], width: 2 },
    SlaveSP: { label: "Slave SP (Water)", color: "#ec4899", scale: "°C", dash: [5, 5], width: 2 },
    ProductDelta: { label: "Product Delta (PV-SP)", color: "#B100CD", scale: "Delta", width: 1.5 }
};
