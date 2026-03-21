// ==========================================
// WORKER-HANDLER.JS - PLC Worker Communication
// ==========================================

let lastHmi = null;
let lastInputs = null;
let lastOutputs = null;
let currentControlMode = null;
let currentSpeedState = null;
let requestTestStart = false;

function initWorker(plcWorker, callbacks) {
    plcWorker.onmessage = function(event) {
        const handlers = {
            'PLC_STATE_UPDATE': handleStateUpdate,
            'SCENE_RESET_COMPLETE': handleSceneReset
        };
        handlers[event.data.type]?.(event.data.payload, callbacks);
    };
}

function handleStateUpdate(payload, callbacks) {
    const { outputs, hmi, inputs } = payload;
    
    lastHmi = hmi;
    lastInputs = inputs;
    lastOutputs = outputs;
    
    callbacks.onUpdateDisplay(hmi, outputs, inputs);
    
    if (inputs.cfg_ControlMode && inputs.cfg_ControlMode !== currentControlMode) {
        currentControlMode = inputs.cfg_ControlMode;
        callbacks.onModeChange(currentControlMode);
    }

    const speedState = inputs.cfg_SpeedMultiplier > 0 ? 'running' : 'stopped';
    if (speedState !== currentSpeedState) {
        currentSpeedState = speedState;
        callbacks.onSpeedChange(speedState);
    }
    
    callbacks.onChartUpdate(hmi, outputs, inputs);
    
    if (requestTestStart) {
        callbacks.onTestStart(hmi);
        requestTestStart = false;
    }
    
    if (callbacks.getIsTestRunning && callbacks.getIsTestRunning()) {
        callbacks.onTestStateMachine(hmi, inputs);
    }
}

function handleSceneReset(payload, callbacks) {
    if (callbacks.getIsTestRunning && callbacks.getIsTestRunning()) {
        callbacks.onTestStop();
    }
    
    callbacks.onResetChart();
    callbacks.onModeReset();
    callbacks.onSliderReset();
    callbacks.onRebuildChart();
}

function sendUpdate(plcWorker, key, value) {
    if (isNaN(value)) return;
    plcWorker.postMessage({
        type: 'WRITE_INPUTS',
        payload: { [key]: value }
    });
}

function resetScene(plcWorker) {
    plcWorker.postMessage({ type: 'RESET_SCENE' });
}

function resetIAE(plcWorker) {
    plcWorker.postMessage({ type: 'RESET_IAE' });
}

function setRequestTestStart(value) {
    requestTestStart = value;
}

function getRequestTestStart() {
    return requestTestStart;
}

function getLastHmi() {
    return lastHmi;
}

function getLastInputs() {
    return lastInputs;
}

function getLastOutputs() {
    return lastOutputs;
}

function getCurrentControlMode() {
    return currentControlMode;
}

function getCurrentSpeedState() {
    return currentSpeedState;
}
