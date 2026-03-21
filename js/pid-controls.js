// ==========================================
// PID-CONTROLS.JS - PID Parameter Bindings & Disturbance Controls
// ==========================================

let disturbanceFlags = 0;

function updateFieldIfNoFocus(element, value) {
    if (element && document.activeElement !== element) {
        element.value = value;
    }
}

function syncFieldsFromInputs(inputs, dom) {
    PID_FIELD_MAPPINGS.forEach(({ domKey, inputKey }) => {
        updateFieldIfNoFocus(dom[domKey], inputs[inputKey]);
    });
}

function bindPidField(domKey, inputKey, dom, plcWorker) {
    const element = dom[domKey];
    if (!element) return;
    element.addEventListener('change', (e) => {
        const value = parseFloat(e.target.value);
        if (isNaN(value)) return;
        plcWorker.postMessage({ type: 'WRITE_INPUTS', payload: { [inputKey]: value } });
    });
}

function bindAllPidFields(dom, plcWorker) {
    PID_FIELD_MAPPINGS.forEach(({ domKey, inputKey }) => {
        bindPidField(domKey, inputKey, dom, plcWorker);
    });
}

function setupValveControls(dom, plcWorker) {
    if (dom.valveSlider) {
        dom.valveSlider.addEventListener('input', (e) => {
            const newVal = parseFloat(e.target.value);
            if (isNaN(newVal)) return;
            if (dom.valveSliderValue) dom.valveSliderValue.textContent = newVal + '%';
            plcWorker.postMessage({ type: 'WRITE_INPUTS', payload: { cmd_ValveManualPercent: newVal } });
        });
    }
}

function setupModeButtons(dom, plcWorker, updateModeDisplay, getIsTestRunning, updateChartVariablesFn) {
    const modes = ['manual', 'single', 'cascade'];
    modes.forEach(mode => {
        const btn = dom[mode + 'Btn'];
        if (btn) {
            btn.addEventListener('click', () => {
                plcWorker.postMessage({ type: 'WRITE_INPUTS', payload: { cfg_ControlMode: mode } });
                updateModeDisplay(mode, dom, getIsTestRunning, updateChartVariablesFn);
            });
        }
    });
}

function setupSlaveOverrideControls(dom, plcWorker) {
    if (dom.slaveOverrideSp) {
        dom.slaveOverrideSp.addEventListener('change', (e) => {
            plcWorker.postMessage({ type: 'WRITE_INPUTS', payload: { slave_override_sp: e.target.checked } });
        });
    }
}

function setupDisturbanceControls(dom, plcWorker) {
    if (dom.distPressureDrop) {
        dom.distPressureDrop.addEventListener('click', () => {
            disturbanceFlags ^= 0x01;
            plcWorker.postMessage({ type: 'WRITE_INPUTS', payload: { cmd_DisturbanceFlags: disturbanceFlags } });
            dom.distPressureDrop.classList.toggle('active', disturbanceFlags & 0x01);
        });
    }

    if (dom.distValveWear) {
        dom.distValveWear.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (dom.distValveWearValue) dom.distValveWearValue.textContent = val.toFixed(1) + '%';
            disturbanceFlags = (val > 0) ? (disturbanceFlags | 0x02) : (disturbanceFlags & ~0x02);
            plcWorker.postMessage({ type: 'WRITE_INPUTS', payload: { dist_ValveWear: val, cmd_DisturbanceFlags: disturbanceFlags } });
        });
    }

    if (dom.distPressureNoise) {
        dom.distPressureNoise.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (dom.distPressureNoiseValue) dom.distPressureNoiseValue.textContent = val.toFixed(2);
            plcWorker.postMessage({ type: 'WRITE_INPUTS', payload: { dist_PressureNoise: val } });
        });
    }

    if (dom.distInletTemp) {
        dom.distInletTemp.addEventListener('change', (e) => {
            plcWorker.postMessage({ type: 'WRITE_INPUTS', payload: { dist_InletTempSP: parseFloat(e.target.value) } });
        });
    }

    if (dom.distInletRate) {
        dom.distInletRate.addEventListener('change', (e) => {
            plcWorker.postMessage({ type: 'WRITE_INPUTS', payload: { dist_InletTempRate: parseFloat(e.target.value) } });
        });
    }
}

function syncDisturbanceDisplays(inputs, dom) {
    DISTURBANCE_VALUE_DISPLAYS.forEach(({ domKey, valueDomKey, suffix, decimals }) => {
        const inputKey = PID_FIELD_MAPPINGS.find(m => m.domKey === domKey)?.inputKey;
        if (inputKey && dom[valueDomKey]) {
            dom[valueDomKey].textContent = (inputs[inputKey] || 0).toFixed(decimals) + suffix;
        }
    });

    if (dom.distPressureDrop) {
        dom.distPressureDrop.classList.toggle('active', inputs.cmd_DisturbanceFlags & 0x01);
        disturbanceFlags = inputs.cmd_DisturbanceFlags;
    }
}

function syncSlaveOverrideState(inputs, dom) {
    if (dom.slaveOverrideSp && document.activeElement !== dom.slaveOverrideSp) {
        dom.slaveOverrideSp.checked = inputs.slave_override_sp;
    }
    if (dom.slaveManualSpRow) {
        dom.slaveManualSpRow.classList.toggle('hidden', !inputs.slave_override_sp);
    }
}

function syncValveSlider(inputs, outputs, dom) {
    if (inputs && inputs.cfg_ControlMode !== 'manual' && dom.valveSlider) {
        dom.valveSlider.value = outputs.actuator_SteamValvePercent;
        if (dom.valveSliderValue) {
            dom.valveSliderValue.textContent = outputs.actuator_SteamValvePercent.toFixed(0) + '%';
        }
    }
}

function getDisturbanceFlags() {
    return disturbanceFlags;
}

function setDisturbanceFlags(flags) {
    disturbanceFlags = flags;
}
