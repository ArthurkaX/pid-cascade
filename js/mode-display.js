// ==========================================
// MODE-DISPLAY.JS - Mode Switching UI
// ==========================================

function updateModeDisplay(mode, dom, getIsTestRunning, updateChartVariables) {
    if (!dom.modeDisplay) return;
    
    switch (mode) {
        case 'running':
            dom.modeDisplay.textContent = 'Running';
            dom.modeDisplay.className = 'mode-badge running';
            break;
        case 'stopped':
            dom.modeDisplay.textContent = 'Paused';
            dom.modeDisplay.className = 'mode-badge stopped';
            break;
        case 'manual':
            dom.controlModeDisplay.textContent = 'Manual Only';
            dom.pidModeDisplay.textContent = '-';
            updateModeButtons('manual', dom, getIsTestRunning);
            if (dom.runTestBtn && !getIsTestRunning()) dom.runTestBtn.disabled = true;
            updateChartVariables('manual');
            switchPidPanel('manual', dom);
            break;
        case 'single':
            dom.controlModeDisplay.textContent = 'Auto Control';
            dom.pidModeDisplay.textContent = '1 PID';
            updateModeButtons('single', dom, getIsTestRunning);
            if (dom.runTestBtn && !getIsTestRunning()) dom.runTestBtn.disabled = false;
            updateChartVariables('single');
            switchPidPanel('single', dom);
            break;
        case 'cascade':
            dom.controlModeDisplay.textContent = 'Auto Control';
            dom.pidModeDisplay.textContent = 'Cascade';
            updateModeButtons('cascade', dom, getIsTestRunning);
            if (dom.runTestBtn && !getIsTestRunning()) dom.runTestBtn.disabled = false;
            updateChartVariables('cascade');
            switchPidPanel('cascade', dom);
            break;
    }
}

function updateModeButtons(activeMode, dom, getIsTestRunning) {
    const modes = ['manual', 'single', 'cascade'];
    modes.forEach(mode => {
        const btn = dom[mode + 'Btn'];
        if (btn) {
            btn.classList.toggle('active', mode === activeMode);
        }
    });
}

function switchPidPanel(mode, dom) {
    if (mode === 'single' || mode === 'manual') {
        if (dom.panelSingle) dom.panelSingle.classList.remove('hidden');
        if (dom.panelCascade) dom.panelCascade.classList.add('hidden');
    } else if (mode === 'cascade') {
        if (dom.panelSingle) dom.panelSingle.classList.add('hidden');
        if (dom.panelCascade) dom.panelCascade.classList.remove('hidden');
    }
}
