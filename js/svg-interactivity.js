// ==========================================
// SVG-INTERACTIVITY.JS - SVG Click Handlers
// ==========================================

function setupSvgInteractivity(dom, plcWorker, updateModeDisplay, getIsTestRunning, updateChartVariablesFn) {
    if (dom.prodTempGroup) {
        dom.prodTempGroup.style.cursor = 'pointer';
        dom.prodTempGroup.addEventListener('click', () => {
            const isSingle = dom.singleBtn.classList.contains('active');
            const targetField = isSingle ? dom.singleSP : dom.masterSP;
            const key = isSingle ? 'single_SP' : 'master_SP';
            const currentSP = targetField ? targetField.value : DEFAULT_SETPOINT;
            const newSP = prompt("Enter new Setpoint (TT201) °C:", currentSP);
            if (newSP !== null && !isNaN(parseFloat(newSP))) {
                const val = parseFloat(newSP);
                if (targetField) targetField.value = val;
                plcWorker.postMessage({ type: 'WRITE_INPUTS', payload: { [key]: val } });
            }
        });
    }

    if (dom.prodTempInGroup) {
        dom.prodTempInGroup.style.cursor = 'pointer';
        dom.prodTempInGroup.addEventListener('click', () => {
            const currentTemp = dom.distInletTemp ? parseFloat(dom.distInletTemp.value) : DEFAULT_TEMPS.product;
            const newTemp = prompt("Enter new Product Inlet Temp (TT202) °C:", currentTemp);
            if (newTemp !== null && !isNaN(parseFloat(newTemp))) {
                const val = parseFloat(newTemp);
                if (dom.distInletTemp) dom.distInletTemp.value = val;
                plcWorker.postMessage({ type: 'WRITE_INPUTS', payload: { dist_InletTempSP: val } });
            }
        });
    }

    if (dom.propValveCvGroup) {
        dom.propValveCvGroup.style.cursor = 'pointer';
        dom.propValveCvGroup.addEventListener('click', () => {
            const currentVal = dom.valveSlider ? dom.valveSlider.value : 0;
            const newVal = prompt("Enter manual Valve position (0-100%):", currentVal);
            if (newVal !== null && !isNaN(parseFloat(newVal))) {
                const val = parseFloat(newVal);
                if (dom.valveSlider) dom.valveSlider.value = val;
                if (dom.valveSliderValue) dom.valveSliderValue.textContent = val + '%';
                plcWorker.postMessage({ type: 'WRITE_INPUTS', payload: { cmd_ValveManualPercent: val, cfg_ControlMode: 'manual' } });
                updateModeDisplay('manual', dom, getIsTestRunning, updateChartVariablesFn);
            }
        });
    }
}

function updateSvgTextFallback(group, text) {
    if (!group) return;
    const textElement = group.querySelector('text');
    if (textElement) {
        textElement.textContent = text;
    }
}
