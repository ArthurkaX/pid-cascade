// ==========================================
// MAIN.JS - HMI/SCADA INTERFACE (Refactored)
// ==========================================

let plcWorker = null;
let dom = {};
let masterChartData = [[], [], [], [], [], [], [], []];
let chartData = [[]];
let startTime = null;

function cacheDOM() {
    dom.prodTempGroup = document.querySelector('[data-cell-id="prod-temp-out"]');
    dom.prodTempInGroup = document.querySelector('[data-cell-id="prod-temp-in"]');
    dom.heatWaterTempGroup = document.querySelector('[data-cell-id="heat-water-temp"]');
    dom.propValveCvGroup = document.querySelector('[data-cell-id="prop-valve-cv"]');
    
    if (dom.prodTempGroup) {
        dom.prodTempText = dom.prodTempGroup.querySelector('foreignObject div div div') ||
                           dom.prodTempGroup.querySelector('text');
    }
    if (dom.prodTempInGroup) {
        dom.prodTempInText = dom.prodTempInGroup.querySelector('foreignObject div div div') ||
                              dom.prodTempInGroup.querySelector('text');
    }
    if (dom.heatWaterTempGroup) {
        dom.heatWaterTempText = dom.heatWaterTempGroup.querySelector('foreignObject div div div') ||
                                  dom.heatWaterTempGroup.querySelector('text');
    }
    if (dom.propValveCvGroup) {
        dom.propValveText = dom.propValveCvGroup.querySelector('foreignObject div div div') ||
                              dom.propValveCvGroup.querySelector('text');
    }
    
    dom.valveSlider = document.getElementById('cmd_valve_slider');
    dom.valveSliderValue = document.getElementById('valve_slider_value');
    dom.iaeDisplay = document.getElementById('val_iae');
    dom.deltaDisplay = document.getElementById('val_delta');
    
    dom.manualBtn = document.getElementById('btn-manual');
    dom.singleBtn = document.getElementById('btn-single');
    dom.cascadeBtn = document.getElementById('btn-cascade');
    dom.resetBtn = document.getElementById('btn-reset');
    dom.runTestBtn = document.getElementById('btn-run-test');
    
    dom.speedSelector = document.getElementById('speed_selector');
    
    dom.startBtn = document.getElementById('btn-start');
    dom.stopBtn = document.getElementById('btn-stop');
    
    dom.masterKp = document.getElementById('pid_master_kp');
    dom.masterTi = document.getElementById('pid_master_ti');
    dom.masterTd = document.getElementById('pid_master_td');
    dom.masterC = document.getElementById('pid_master_c');
    dom.masterB = document.getElementById('pid_master_b');
    dom.masterA = document.getElementById('pid_master_a');
    dom.masterOutH = document.getElementById('pid_master_out_h');
    dom.masterOutL = document.getElementById('pid_master_out_l');
    dom.masterDeadband = document.getElementById('pid_master_deadband');
    dom.masterSP = document.getElementById('pid_master_sp');
    
    dom.slaveKp = document.getElementById('pid_slave_kp');
    dom.slaveTi = document.getElementById('pid_slave_ti');
    dom.slaveTd = document.getElementById('pid_slave_td');
    dom.slaveC = document.getElementById('pid_slave_c');
    dom.slaveB = document.getElementById('pid_slave_b');
    dom.slaveA = document.getElementById('pid_slave_a');
    dom.slaveOutH = document.getElementById('pid_slave_out_h');
    dom.slaveOutL = document.getElementById('pid_slave_out_l');
    dom.slaveDeadband = document.getElementById('pid_slave_deadband');
    dom.slaveOverrideSp = document.getElementById('slave_override_sp');
    dom.slaveManualSp = document.getElementById('slave_manual_sp');
    dom.slaveManualSpRow = document.getElementById('slave_manual_sp_row');
    
    dom.singleKp = document.getElementById('pid_single_kp');
    dom.singleTi = document.getElementById('pid_single_ti');
    dom.singleTd = document.getElementById('pid_single_td');
    dom.singleC = document.getElementById('pid_single_c');
    dom.singleB = document.getElementById('pid_single_b');
    dom.singleA = document.getElementById('pid_single_a');
    dom.singleOutH = document.getElementById('pid_single_out_h');
    dom.singleOutL = document.getElementById('pid_single_out_l');
    dom.singleDeadband = document.getElementById('pid_single_deadband');
    dom.singleSP = document.getElementById('pid_single_sp');
    
    dom.panelSingle = document.getElementById('panel_pid_single');
    dom.panelCascade = document.getElementById('panel_pid_cascade');
    
    dom.modeDisplay = document.getElementById('mode_display');
    dom.controlModeDisplay = document.getElementById('control_mode_display');
    dom.pidModeDisplay = document.getElementById('pid_mode_display');
    
    dom.distPressureDrop = document.getElementById('dist_pressure_drop');
    dom.distValveWear = document.getElementById('dist_valve_wear');
    dom.distValveWearValue = document.getElementById('dist_valve_wear_value');
    dom.distPressureNoise = document.getElementById('dist_steam_pressure_noise');
    dom.distPressureNoiseValue = document.getElementById('dist_steam_pressure_noise_value');
    dom.distInletTemp = document.getElementById('dist_inlet_temp');
    dom.distInletRate = document.getElementById('dist_inlet_rate');
    
    dom.resetIaeBtn = document.getElementById('btn-reset-iae');
}

function updateDisplay(hmi, outputs, inputs, dom) {
    if (dom.prodTempText) {
        const tempText = hmi.vis_TMilkOutlet.toFixed(1) + ' °C';
        dom.prodTempText.textContent = tempText;
        updateSvgTextFallback(dom.prodTempGroup, tempText);
    }
    
    if (dom.prodTempInText) {
        const tempText = hmi.vis_TMilkInlet.toFixed(1) + ' °C';
        dom.prodTempInText.textContent = tempText;
        updateSvgTextFallback(dom.prodTempInGroup, tempText);
    }
    
    if (dom.heatWaterTempText) {
        const tempText = hmi.vis_TWaterAfterSteam.toFixed(1) + ' °C';
        dom.heatWaterTempText.textContent = tempText;
        updateSvgTextFallback(dom.heatWaterTempGroup, tempText);
    }
    
    if (dom.propValveText) {
        const valveText = outputs.actuator_SteamValvePercent.toFixed(0) + '%';
        dom.propValveText.textContent = valveText;
        updateSvgTextFallback(dom.propValveCvGroup, valveText);
    }
    
    if (dom.iaeDisplay) {
        dom.iaeDisplay.textContent = hmi.score_IAE.toFixed(2);
    }
    if (dom.deltaDisplay) {
        dom.deltaDisplay.textContent = (hmi.vis_ProductDelta || 0).toFixed(2) + ' °C';
        const delta = Math.abs(hmi.vis_ProductDelta || 0);
        dom.deltaDisplay.style.color = delta < 0.5 ? '#10b981' : (delta < 2 ? '#f59e0b' : '#ef4444');
    }
    
    syncValveSlider(inputs, outputs, dom);
    
    if (inputs) {
        syncFieldsFromInputs(inputs, dom);
        syncSlaveOverrideState(inputs, dom);
        syncDisturbanceDisplays(inputs, dom);
    }
}

function initializeDisplays(dom) {
    if (dom.prodTempGroup) {
        const tempText = DEFAULT_TEMPS.product.toFixed(1) + ' °C';
        if (dom.prodTempText) dom.prodTempText.textContent = tempText;
        updateSvgTextFallback(dom.prodTempGroup, tempText);
    }
    
    if (dom.prodTempInGroup) {
        const tempText = DEFAULT_TEMPS.product.toFixed(1) + ' °C';
        if (dom.prodTempInText) dom.prodTempInText.textContent = tempText;
        updateSvgTextFallback(dom.prodTempInGroup, tempText);
    }
    
    if (dom.heatWaterTempGroup) {
        const tempText = DEFAULT_TEMPS.water.toFixed(1) + ' °C';
        if (dom.heatWaterTempText) dom.heatWaterTempText.textContent = tempText;
        updateSvgTextFallback(dom.heatWaterTempGroup, tempText);
    }
    
    if (dom.propValveCvGroup) {
        const valveText = '0%';
        if (dom.propValveText) dom.propValveText.textContent = valveText;
        updateSvgTextFallback(dom.propValveCvGroup, valveText);
    }
    
    if (dom.iaeDisplay) {
        dom.iaeDisplay.textContent = '0.00';
    }
    
    if (dom.valveSliderValue) {
        dom.valveSliderValue.textContent = '0%';
    }
}

function setupSpeedSelector(dom, plcWorker, updateModeDisplay, getIsTestRunning, updateChartVariablesFn) {
    if (dom.speedSelector) {
        dom.speedSelector.addEventListener('change', (e) => {
            const speed = parseInt(e.target.value);
            plcWorker.postMessage({ type: 'WRITE_INPUTS', payload: { cfg_SpeedMultiplier: speed } });
            updateModeDisplay(speed > 0 ? 'running' : 'stopped', dom, getIsTestRunning, updateChartVariablesFn);
        });
    }
}

function setupResetButtons(dom, plcWorker) {
    if (dom.resetBtn) {
        dom.resetBtn.addEventListener('click', () => resetScene(plcWorker));
    }
    if (dom.resetIaeBtn) {
        dom.resetIaeBtn.addEventListener('click', () => resetIAE(plcWorker));
    }
}

function setupTestButton(dom) {
    if (!dom.runTestBtn) return;
    dom.runTestBtn.addEventListener('click', () => {
        if (getIsTestRunning()) return;
        
        const mode = getCurrentControlMode() || 'manual';
        const inputs = getLastInputs();
        const hmi = getLastHmi();
        const currentSP = (mode === 'single') ? inputs?.single_SP : inputs?.master_SP;
        const delta = Math.abs(hmi?.vis_ProductDelta ?? 999);
        
        if (currentSP !== DEFAULT_SETPOINT) {
            console.log(`%c[TEST] BLOCKED: SP=${currentSP}°C (need ${DEFAULT_SETPOINT}°C)`, 'color: #ef4444');
            alert(`Test requires SP = ${DEFAULT_SETPOINT}°C.\nCurrent SP: ${currentSP}°C`);
            return;
        }
        if (delta >= 1.0) {
            console.log(`%c[TEST] BLOCKED: delta=${delta.toFixed(2)}°C (need <1.0°C)`, 'color: #ef4444');
            alert(`Test requires stable process (|PV-SP| < 1°C).\nCurrent delta: ${delta.toFixed(2)}°C`);
            return;
        }
        
        console.log(`[TEST] Preconditions OK: SP=${currentSP}°C, delta=${delta.toFixed(2)}°C`);
        setRequestTestStart(true);
    });
}

function setupAllListeners(dom, plcWorker, updateModeDisplay, getIsTestRunning, updateChartVariablesFn) {
    setupValveControls(dom, plcWorker);
    setupModeButtons(dom, plcWorker, updateModeDisplay, getIsTestRunning, updateChartVariablesFn);
    setupSpeedSelector(dom, plcWorker, updateModeDisplay, getIsTestRunning, updateChartVariablesFn);
    setupResetButtons(dom, plcWorker);
    setupTestButton(dom);
    bindAllPidFields(dom, plcWorker);
    setupSlaveOverrideControls(dom, plcWorker);
    setupDisturbanceControls(dom, plcWorker);
    setupSvgInteractivity(dom, plcWorker, updateModeDisplay, getIsTestRunning, updateChartVariablesFn);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('HMI DOMContentLoaded');
    
    setTimeout(() => {
        try {
            console.log('[main.js] Step 1: cacheDOM');
            cacheDOM();
            console.log('[main.js] Step 2: Create Worker');
            plcWorker = new Worker('worker.js');
            console.log('[main.js] Step 3: initChart');
            initChart(masterChartData, chartData, dom);
            console.log('[main.js] Step 4: initUITooltips');
            initUITooltips();
            console.log('[main.js] Step 5: setupAllListeners');
            setupAllListeners(dom, plcWorker, (mode) => updateModeDisplay(mode, dom, getIsTestRunning, updateChartVariables));
            console.log('[main.js] Step 6: initializeDisplays');
            initializeDisplays(dom);
            console.log('[main.js] Step 7: updateModeDisplay manual');
            updateModeDisplay('manual', dom, () => false, updateChartVariables);
            console.log('[main.js] Step 8: updateModeDisplay running');
            updateModeDisplay('running', dom, () => false, updateChartVariables);
            console.log('[main.js] Step 9: initWorker');
            initWorker(plcWorker, {
                onUpdateDisplay: (hmi, outputs, inputs) => updateDisplay(hmi, outputs, inputs, dom),
                onModeChange: (mode) => updateModeDisplay(mode, dom, getIsTestRunning, updateChartVariables),
                onSpeedChange: (speed) => updateModeDisplay(speed, dom, getIsTestRunning, updateChartVariables),
                onChartUpdate: (hmi, outputs, inputs) => updateChart(hmi, outputs, inputs, masterChartData, chartData),
                onTestStart: (hmi) => startTest(hmi, dom, plcWorker, setDisturbanceFlags, (active) => setTestModeUI(active, dom)),
                onTestStateMachine: (hmi, inputs) => handleTestStateMachine(hmi, inputs, dom, plcWorker, setDisturbanceFlags, (active) => setTestModeUI(active, dom)),
                onTestStop: () => setTestRunning(false),
                onResetChart: () => clearChartData(masterChartData, chartData),
                onModeReset: () => updateModeDisplay('manual', dom, () => false, updateChartVariables),
                onSliderReset: () => {
                    if (dom.valveSlider) dom.valveSlider.value = 0;
                    if (dom.valveSliderValue) dom.valveSliderValue.textContent = '0%';
                },
                onRebuildChart: () => rebuildChart(masterChartData, chartData),
                getIsTestRunning: getIsTestRunning
            });
            console.log('[main.js] Step 10: Done');
            console.log('HMI Initialized (Always-on Simulation)');
        } catch (e) {
            console.error('[main.js] Initialization error:', e);
            console.error('[main.js] Stack:', e.stack);
        }
    }, 100);
});
