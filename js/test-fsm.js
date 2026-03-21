// ==========================================
// TEST-FSM.JS - Test State Machine
// ==========================================

let isTestRunning = false;
let testState = 0;
let testStageTimer = 0;
let testSettledTimer = 0;
let previousSimTime = 0;
let testStartTime = 0;

function startTest(hmi, dom, plcWorker, setDisturbanceFlags, setTestModeUI) {
    if (isTestRunning) return;
    isTestRunning = true;
    testState = 1;
    testStageTimer = 0;
    testSettledTimer = 0;
    previousSimTime = hmi.vis_SimulationTime;
    testStartTime = hmi.vis_SimulationTime;
    
    let disturbanceFlags = getDisturbanceFlags();
    disturbanceFlags |= 0x02;
    disturbanceFlags &= ~0x01;
    setDisturbanceFlags(disturbanceFlags);
    
    const mode = currentControlMode || 'unknown';
    const sp = (mode === 'single') ? lastInputs?.single_SP : lastInputs?.master_SP;
    console.log(`%c[TEST] +0.0s ========== STARTED ==========`, 'color: #f59e0b; font-weight: bold');
    console.log(`[TEST] +0.0s Mode: ${mode} | SP: ${sp}°C | Initial Delta: ${hmi.vis_ProductDelta?.toFixed(2)}°C`);
    console.log(`[TEST] +0.0s Disturbances: ValveWear=2.5%, PressureNoise=0.5 BAR`);
    
    plcWorker.postMessage({
        type: 'WRITE_INPUTS',
        payload: { 
            dist_ValveWear: 2.5,
            dist_PressureNoise: 0.5,
            cmd_DisturbanceFlags: getDisturbanceFlags()
        }
    });

    if (dom.distValveWear) dom.distValveWear.value = 2.5;
    if (dom.distValveWearValue) dom.distValveWearValue.textContent = '2.5%';
    if (dom.distPressureNoise) dom.distPressureNoise.value = 0.5;
    if (dom.distPressureNoiseValue) dom.distPressureNoiseValue.textContent = '0.50';
    if (dom.distPressureDrop) dom.distPressureDrop.classList.remove('active');
    
    plcWorker.postMessage({ type: 'RESET_IAE' });
    setTestModeUI(true);
    console.log(`[TEST] +0.0s Phase 1: Stabilize (waiting ${TEST_SETTLED_DURATION}s with |delta|<${TEST_SETTLED_THRESHOLD}°C)`);
}

function handleTestStateMachine(hmi, inputs, dom, plcWorker, setDisturbanceFlags, setTestModeUI) {
    if (!isTestRunning) return;
    
    let dt = hmi.vis_SimulationTime - previousSimTime;
    if (dt < 0) dt = 0;
    previousSimTime = hmi.vis_SimulationTime;
    testStageTimer += dt;
    
    const elapsed = (hmi.vis_SimulationTime - testStartTime).toFixed(1);
    const phaseIndex = testState - 1;
    
    if (testState >= 1 && testState <= 3) {
        const phase = TEST_PHASES[phaseIndex];
        const remaining = Math.max(0, TEST_SETTLED_DURATION - testStageTimer).toFixed(0);
        
        if (dom.runTestBtn) dom.runTestBtn.textContent = `Test: ${phase.name} (${remaining}s)`;
        
        testSettledTimer = Math.abs(hmi.vis_ProductDelta) < TEST_SETTLED_THRESHOLD ? testSettledTimer + dt : 0;
        
        if (testSettledTimer >= TEST_SETTLED_DURATION || (testStageTimer > phase.timeout && Math.abs(hmi.vis_ProductDelta) < TEST_SETTLED_THRESHOLD)) {
            console.log(`[TEST] +${elapsed}s Phase ${testState}: ${phase.name} settled | delta=${hmi.vis_ProductDelta?.toFixed(2)}°C | valve=${lastOutputs?.actuator_SteamValvePercent?.toFixed(0)}%`);
            console.log(`[TEST] +${elapsed}s Phase ${testState} → ${testState + 1}: ${phase.nextLog}`);
            
            testState++;
            testStageTimer = 0;
            testSettledTimer = 0;
            
            if (phase.inletTemp !== undefined) {
                plcWorker.postMessage({ type: 'WRITE_INPUTS', payload: { dist_InletTempSP: phase.inletTemp } });
                if (dom.distInletTemp) dom.distInletTemp.value = phase.inletTemp;
            }
            if (phase.boilerFail) {
                let flags = getDisturbanceFlags();
                flags |= 0x01;
                setDisturbanceFlags(flags);
                plcWorker.postMessage({ type: 'WRITE_INPUTS', payload: { cmd_DisturbanceFlags: flags } });
                if (dom.distPressureDrop) dom.distPressureDrop.classList.add('active');
            }
        }
    }
    else if (testState === 4) {
        if (dom.runTestBtn) dom.runTestBtn.textContent = `Test: Boiler Fail (${testStageTimer.toFixed(0)}s)`;
        
        if (testStageTimer >= TEST_PHASE_TIMEOUT.boiler) {
            const finalScore = dom.iaeDisplay ? dom.iaeDisplay.textContent : 'Unknown';
            const totalDuration = hmi.vis_SimulationTime - testStartTime;
            
            console.log(`[TEST] +${elapsed}s Phase 4: Boiler Fail | Pressure=${hmi.vis_SteamPressure?.toFixed(1)} Bar | delta=${hmi.vis_ProductDelta?.toFixed(2)}°C`);
            console.log(`%c[TEST] +${elapsed}s ========== COMPLETED ==========`, 'color: #10b981; font-weight: bold');
            console.log(`[TEST] +${elapsed}s Final IAE Score: ${finalScore}`);
            console.log(`[TEST] +${elapsed}s Total Duration: ${totalDuration?.toFixed(1)}s`);
            console.log(`[TEST] ==================================`);
            
            isTestRunning = false;
            setTestModeUI(false);
            
            setTimeout(() => alert(`Test Completed!\nFinal IAE Score: ${finalScore}`), 100);
            if (dom.runTestBtn) dom.runTestBtn.textContent = `Run Test`;
        }
    }
}

function setTestRunning(value) {
    isTestRunning = value;
}

function getIsTestRunning() {
    return isTestRunning;
}

function getTestState() {
    return testState;
}

function setTestState(value) {
    testState = value;
}

function setTestModeUI(active, dom) {
    if (dom.manualBtn) dom.manualBtn.disabled = active;
    if (dom.singleBtn) dom.singleBtn.disabled = active;
    if (dom.cascadeBtn) dom.cascadeBtn.disabled = active;
    
    if (dom.runTestBtn) {
        dom.runTestBtn.disabled = active;
        dom.runTestBtn.textContent = active ? 'Testing...' : 'Run Test';
    }

    const panels = document.querySelectorAll('.control-panel, .manual-control');
    panels.forEach(p => {
        const inputs = p.querySelectorAll('input, button');
        inputs.forEach(el => {
            el.disabled = active;
        });
    });
}
