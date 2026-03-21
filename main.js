// ==========================================
// MAIN.JS - HMI/SCADA INTERFACE
// ==========================================

// ==========================================
// CONSTANTS
// ==========================================
const CHART_MAX_BUFFER_POINTS = 200000;
const TEST_SETTLED_THRESHOLD = 1.0;
const TEST_SETTLED_DURATION = 15;
const TEST_PHASE_TIMEOUT = { stabilize: 360, product: 180, water: 300, boiler: 90 };
const DEFAULT_TIME_WINDOW = 60;
const DEFAULT_SETPOINT = 72;
const DEFAULT_TEMPS = { product: 20, water: 55 };

// ==========================================
// SCORE MODAL & LEADERBOARD FUNCTIONS
// ==========================================

let lastTestScore = null;
let lastTestMode = null;
let lastTestDuration = null;

function showScoreModal(score, mode, duration) {
    lastTestScore = score;
    lastTestMode = mode;
    lastTestDuration = duration;
    
    const modal = document.getElementById('score-modal');
    const scoreValue = document.getElementById('modal-score-value');
    const modeDisplay = document.getElementById('modal-mode');
    const durationDisplay = document.getElementById('modal-duration');
    const nameInput = document.getElementById('player-name');
    const saveBtn = document.getElementById('btn-save-score');
    const statusDiv = document.getElementById('save-status');
    
    if (!modal) return;
    
    scoreValue.textContent = score;
    modeDisplay.textContent = mode === 'cascade' ? 'Cascade PID' : 'Single PID';
    durationDisplay.textContent = duration + 's';
    
    nameInput.value = '';
    saveBtn.disabled = true;
    statusDiv.classList.add('hidden');
    statusDiv.textContent = '';
    
    modal.classList.remove('hidden');
    nameInput.focus();
}

function hideScoreModal() {
    const modal = document.getElementById('score-modal');
    if (modal) modal.classList.add('hidden');
}

function showLeaderboard() {
    const panel = document.getElementById('leaderboard-panel');
    if (!panel) return;
    
    panel.classList.remove('hidden');
    loadLeaderboard();
}

function hideLeaderboard() {
    const panel = document.getElementById('leaderboard-panel');
    if (panel) panel.classList.add('hidden');
}

async function loadLeaderboard() {
    const tbody = document.getElementById('leaderboard-body');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" class="loading">Loading...</td></tr>';
    
    const scores = await getLeaderboard(100);
    
    if (scores.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading">No scores yet. Be the first!</td></tr>';
        return;
    }
    
    tbody.innerHTML = scores.map((entry, index) => {
        const rankClass = index < 3 ? `rank-${index + 1}` : '';
        const modeClass = entry.mode === 'cascade' ? 'cascade' : 'single';
        return `
            <tr>
                <td class="${rankClass}">${index + 1}</td>
                <td>${escapeHtml(entry.name)}</td>
                <td>${entry.score.toFixed(2)}</td>
                <td><span class="mode-badge-small ${modeClass}">${entry.mode}</span></td>
                <td>${entry.date || '-'}</td>
            </tr>
        `;
    }).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function setupModalEventListeners() {
    try {
        console.log('[Modal] Setting up event listeners...');
        
        const nameInput = document.getElementById('player-name');
        const saveBtn = document.getElementById('btn-save-score');
        const skipBtn = document.getElementById('btn-skip-score');
        const viewLeaderboardBtn = document.getElementById('btn-view-leaderboard');
        const closeLeaderboardBtn = document.getElementById('btn-close-leaderboard');
        const refreshLeaderboardBtn = document.getElementById('btn-refresh-leaderboard');
        const leaderboardBtn = document.getElementById('btn-leaderboard');
        const modal = document.getElementById('score-modal');
        const leaderboardPanel = document.getElementById('leaderboard-panel');
        const statusDiv = document.getElementById('save-status');
        
        console.log('[Modal] Elements found:', {
            nameInput: !!nameInput,
            saveBtn: !!saveBtn,
            skipBtn: !!skipBtn,
            viewLeaderboardBtn: !!viewLeaderboardBtn,
            leaderboardBtn: !!leaderboardBtn
        });
        
        if (nameInput) {
            nameInput.addEventListener('input', () => {
                if (saveBtn) saveBtn.disabled = nameInput.value.trim().length === 0;
            });
            
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !saveBtn.disabled) {
                    saveBtn.click();
                }
            });
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const name = nameInput.value.trim() || 'Anonymous';
                
                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';
                statusDiv.classList.remove('hidden');
                statusDiv.classList.remove('error');
                statusDiv.classList.add('success');
                statusDiv.textContent = 'Saving...';
                
                const result = await saveScoreToFirebase(name, lastTestScore, lastTestMode);
                
                if (result.success) {
                    statusDiv.textContent = 'Score saved!';
                    saveBtn.textContent = 'Saved!';
                    
                    setTimeout(() => {
                        hideScoreModal();
                        showLeaderboard();
                    }, 800);
                } else {
                    statusDiv.classList.remove('success');
                    statusDiv.classList.add('error');
                    statusDiv.textContent = 'Error: ' + (result.error || 'Failed to save');
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save Score';
                }
            });
        }
        
        if (skipBtn) {
            skipBtn.addEventListener('click', hideScoreModal);
        }
        
        if (viewLeaderboardBtn) {
            viewLeaderboardBtn.addEventListener('click', () => {
                hideScoreModal();
                showLeaderboard();
            });
        }
        
        if (closeLeaderboardBtn) {
            closeLeaderboardBtn.addEventListener('click', hideLeaderboard);
        }
        
        if (leaderboardBtn) {
            leaderboardBtn.addEventListener('click', showLeaderboard);
        }
        
        if (refreshLeaderboardBtn) {
            refreshLeaderboardBtn.addEventListener('click', loadLeaderboard);
        }
        
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) hideScoreModal();
            });
        }
        
        if (leaderboardPanel) {
            leaderboardPanel.addEventListener('click', (e) => {
                if (e.target === leaderboardPanel) hideLeaderboard();
            });
        }
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                hideScoreModal();
                hideLeaderboard();
            }
        });
        
        console.log('[Modal] Event listeners setup complete');
    } catch (error) {
        console.error('[Modal] Error setting up event listeners:', error);
    }
}

// ==========================================
// INITIALIZATION
// ==========================================

const plcWorker = new Worker('worker.js');

let chart = null;
let startTime = null;
let latestSimTime = 0;
let masterChartData = [[], [], [], [], [], [], [], []];
let chartData = [[]];
let timeWindowSeconds = DEFAULT_TIME_WINDOW;
let isPaused = false;
let currentZoom = null;
let currentControlMode = null;
let currentSpeedState = null;
let disturbanceFlags = 0;
let isTestRunning = false;
let requestTestStart = false;
let testState = 0;
let testStageTimer = 0;
let testSettledTimer = 0;
let previousSimTime = 0;
let testStartTime = 0;
let testInletReached = false;
let testInletLastLogged = -1;
let lastProcessedTestState = -1;
let lastHmi = null;
let lastInputs = null;
let lastOutputs = null;

// ==========================================
// DOM CACHE
// ==========================================

const dom = {};

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

function cacheDOM() {
    // SVG elements - find by data-cell-id
    dom.prodTempGroup = document.querySelector('[data-cell-id="prod-temp-out"]');
    dom.prodTempInGroup = document.querySelector('[data-cell-id="prod-temp-in"]');
    dom.heatWaterTempGroup = document.querySelector('[data-cell-id="heat-water-temp"]');
    dom.propValveCvGroup = document.querySelector('[data-cell-id="prop-valve-cv"]');
    
    // SVG text elements
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
    
    // Valve control
    dom.valveSlider = document.getElementById('cmd_valve_slider');
    dom.valveSliderValue = document.getElementById('valve_slider_value');
    
    // IAE display
    dom.iaeDisplay = document.getElementById('val_iae');
    
    // Mode Buttons
    dom.manualBtn = document.getElementById('btn-manual');
    dom.singleBtn = document.getElementById('btn-single');
    dom.cascadeBtn = document.getElementById('btn-cascade');
    dom.resetBtn = document.getElementById('btn-reset');
    dom.runTestBtn = document.getElementById('btn-run-test');
    
    // Selectors
    dom.speedSelector = document.getElementById('speed_selector');
    
    // Control buttons
    dom.startBtn = document.getElementById('btn-start');
    dom.stopBtn = document.getElementById('btn-stop');
    dom.resetBtn = document.getElementById('btn-reset');
    
    // PID Master params
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
    
    // PID Slave params
    dom.slaveKp = document.getElementById('pid_slave_kp');
    dom.slaveTi = document.getElementById('pid_slave_ti');
    dom.slaveTd = document.getElementById('pid_slave_td');
    dom.slaveC = document.getElementById('pid_slave_c');
    dom.slaveB = document.getElementById('pid_slave_b');
    dom.slaveA = document.getElementById('pid_slave_a');
    dom.slaveOutH = document.getElementById('pid_slave_out_h');
    dom.slaveOutL = document.getElementById('pid_slave_out_l');
    dom.slaveDeadband = document.getElementById('pid_slave_deadband');
    dom.slaveOverrideSp = document.getElementById('pid_slave_override_sp');
    dom.slaveManualSp = document.getElementById('pid_slave_manual_sp');
    dom.slaveManualSpRow = document.getElementById('slave_manual_sp_row');

    // PID Single params
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

    // Panels for toggling
    dom.panelSingle = document.getElementById('panel_pid_single');
    dom.panelCascade = document.getElementById('panel_pid_cascade');
    
    // Mode indicators
    dom.modeDisplay = document.getElementById('mode_display');
    dom.controlModeDisplay = document.getElementById('control_mode_display');
    dom.pidModeDisplay = document.getElementById('pid_mode_display');
    
    // Disturbance controls
    dom.distPressureDrop = document.getElementById('dist_pressure_drop');
    dom.distValveWear = document.getElementById('dist_valve_wear');
    dom.distValveWearValue = document.getElementById('dist_valve_wear_value');
    dom.distPressureNoise = document.getElementById('dist_steam_pressure_noise');
    dom.distPressureNoiseValue = document.getElementById('dist_steam_pressure_noise_value');
    dom.distInletTemp = document.getElementById('dist_inlet_temp');
    dom.distInletRate = document.getElementById('dist_inlet_rate');
    
    dom.iaeDisplay = document.getElementById('val_iae');
    dom.deltaDisplay = document.getElementById('val_delta');
    dom.resetIaeBtn = document.getElementById('btn-reset-iae');
}

// ==========================================
// UPLOT CHART INITIALIZATION
// ==========================================

// Available variables configuration
const variableConfig = {
    TMilkOutlet: { label: "TT201 (Product Out)", color: "#0055FF", scale: "°C", width: 3 },
    TMilkInlet: { label: "TT202 (Product In)", color: "#6366f1", scale: "°C", width: 3 },
    TWaterAfterSteam: { label: "TT101 (Water)", color: "#008F39", scale: "°C", width: 1.5 },
    Valve: { label: "Y101 (Valve %)", color: "#E68A00", scale: "%", width: 2 },
    ProductSP: { label: "SP (Product)", color: "#CC0000", scale: "°C", dash: [5, 5], width: 2 },
    SlaveSP: { label: "Slave SP (Water)", color: "#ec4899", scale: "°C", dash: [5, 5], width: 2 },
    ProductDelta: { label: "Product Delta (PV-SP)", color: "#B100CD", scale: "Delta", width: 1.5 }
};

// Selected variables set
let selectedVariables = new Set();

// Track Alt key state for tooltip display
let isAltPressed = false;

/**
 * uPlot Tooltip Plugin
 */
function tooltipPlugin() {
    let tooltip;

    return {
        hooks: {
            init: u => {
                tooltip = document.createElement("div");
                tooltip.className = "chart-tooltip";
                tooltip.style.display = "none";
                tooltip.style.position = "absolute";
                tooltip.style.pointerEvents = "none";
                tooltip.style.zIndex = "10000";
                document.body.appendChild(tooltip);

                // RELIABLE ALT TRACKING: 
                // Listen directly on the interaction layer
                u.over.addEventListener('mousemove', e => {
                    isAltPressed = e.altKey;
                    
                    // If Alt is pressed, we might need to show the tooltip immediately
                    // even if uPlot's setCursor didn't fire yet for this exact pixel
                    if (isAltPressed && u.cursor.idx != null) {
                        updateTooltip(u, u.cursor.left, u.cursor.top, u.cursor.idx);
                    } else if (!isAltPressed) {
                        tooltip.style.display = "none";
                    }
                });

                // Handle Alt key even if mouse is not moving
                const keyHandler = (e) => {
                    if (e.key === 'Alt') {
                        isAltPressed = (e.type === 'keydown');
                        if (u.cursor.idx != null) {
                             if (isAltPressed) updateTooltip(u, u.cursor.left, u.cursor.top, u.cursor.idx);
                             else tooltip.style.display = "none";
                        }
                    }
                };
                window.addEventListener('keydown', keyHandler);
                window.addEventListener('keyup', keyHandler);
                
                // Helper to update tooltip content and position
                function updateTooltip(u, left, top, idx) {
                    tooltip.style.display = "block";
                    
                    const chartRect = u.over.getBoundingClientRect();
                    const overWidth = u.over.offsetWidth;
                    
                    let tooltipLeft = chartRect.left + window.scrollX + left + 15;
                    if (left + 220 > overWidth) {
                        tooltipLeft = chartRect.left + window.scrollX + left - 235;
                    }
                    
                    tooltip.style.left = tooltipLeft + "px";
                    tooltip.style.top = (chartRect.top + window.scrollY + top + 15) + "px";

                    let html = `<div class="tooltip-time">Time: ${u.data[0][idx].toFixed(2)}s</div>`;
                    html += '<div class="tooltip-slice">';
                    
                    u.series.forEach((s, i) => {
                        if (i > 0 && s.show) {
                            const val = u.data[i][idx];
                            const label = s.label;
                            const color = s.stroke;
                            const formattedVal = (val != null && !isNaN(val)) ? val.toFixed(2) : '-';
                            const scale = s.scale || '';
                            
                            html += `
                                <div class="tooltip-item">
                                    <span class="tooltip-color" style="background-color: ${color}"></span>
                                    <span class="tooltip-label">${label}:</span>
                                    <span class="tooltip-value">${formattedVal}${scale}</span>
                                </div>
                            `;
                        }
                    });
                    html += '</div>';
                    html += '<span class="tooltip-hint">Release ALT to hide</span>';
                    tooltip.innerHTML = html;
                }

                u.updateTooltip = updateTooltip;
                u._keyHandler = keyHandler;
            },
            setCursor: u => {
                const { left, top, idx } = u.cursor;
                if (idx == null || !isAltPressed) {
                    tooltip.style.display = "none";
                } else {
                    u.updateTooltip(u, left, top, idx);
                }
            },
            destroy: u => {
                window.removeEventListener('keydown', u._keyHandler);
                window.removeEventListener('keyup', u._keyHandler);
                if (tooltip && tooltip.parentNode) {
                    tooltip.parentNode.removeChild(tooltip);
                }
            }
        }
    };
}

// ==========================================
// UI TOOLTIP SYSTEM (ALT + HOVER)
// ==========================================

function initUITooltips() {
    const uiTooltip = document.createElement('div');
    uiTooltip.className = 'ui-tooltip';
    uiTooltip.style.display = 'none';
    document.body.appendChild(uiTooltip);

    let activeElement = null;

    // Monitor ALT key globally for UI
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Alt') {
            document.body.classList.add('alt-pressed');
            if (activeElement) showHint(activeElement);
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'Alt') {
            document.body.classList.remove('alt-pressed');
            uiTooltip.style.display = 'none';
        }
    });

    // Delegate mouseover for elements with data-hint
    document.addEventListener('mouseover', (e) => {
        const hintEl = e.target.closest('[data-hint]');
        if (hintEl) {
            activeElement = hintEl;
            if (isAltPressed) showHint(hintEl);
        }
    });

    document.addEventListener('mouseout', (e) => {
        const hintEl = e.target.closest('[data-hint]');
        if (hintEl) {
            activeElement = null;
            uiTooltip.style.display = 'none';
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (uiTooltip.style.display === 'block') {
            positionTooltip(e);
        }
    });

    function showHint(el) {
        const hint = el.getAttribute('data-hint');
        const label = el.querySelector('label')?.textContent || el.textContent || "Hint";
        
        uiTooltip.innerHTML = `<b>${label.replace(':', '')}</b>${hint}`;
        uiTooltip.style.display = 'block';
    }

    function positionTooltip(e) {
        const x = e.pageX + 15;
        const y = e.pageY + 15;
        
        // Keep inside viewport
        const width = uiTooltip.offsetWidth;
        const rightEdge = window.innerWidth + window.scrollX;
        
        let finalX = x;
        if (x + width > rightEdge) {
            finalX = e.pageX - width - 15;
        }

        uiTooltip.style.left = finalX + 'px';
        uiTooltip.style.top = y + 'px';
    }
}

function initChart() {
    // Initial chart variables for default mode
    updateChartVariables('manual');

    // Setup time window selector
    const timeWindowSelect = document.getElementById('time-window');
    if (timeWindowSelect) {
        timeWindowSelect.addEventListener('change', (e) => {
            timeWindowSeconds = parseInt(e.target.value);
            currentZoom = null; // Reset zoom when time window changes
            // Force update chart display with new time window
            if (chart && chartData[0].length > 0) {
                const latestTime = chartData[0][chartData[0].length - 1];
                const minTime = latestTime - timeWindowSeconds;
                
                // Filter data to show only the selected time window
                const filteredData = chartData.map(series => {
                    return series.filter((val, idx) => {
                        const timeVal = chartData[0][idx];
                        return timeVal >= minTime && timeVal <= latestTime;
                    });
                });
                
                chart.setData(filteredData);
            }
        });
    }
    
    // Setup pause button
    const pauseBtn = document.getElementById('btn-pause-chart');
    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            isPaused = !isPaused;
            pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
            pauseBtn.classList.toggle('btn-primary', isPaused);
            pauseBtn.classList.toggle('btn-secondary', !isPaused);
        });
    }
    
    const resetZoomBtn = document.getElementById('btn-reset-zoom');
    if (resetZoomBtn) {
        resetZoomBtn.addEventListener('click', () => {
            currentZoom = null;
            if (chart) {
                rebuildChart();
            }
        });
    }
    
    // Initial chart build
    rebuildChart();
}

function rebuildChart() {
    // Destroy existing chart if it exists
    if (chart) {
        chart.destroy();
        chart = null;
    }
    
    const container = document.getElementById('chart-container');
    const containerWidth = container.offsetWidth;
    const containerHeight = 500;
    
    // Build series array based on selected variables
    const series = [{ label: "Time (s)" }];
    const scales = {};
    const axes = [{
        grid: { stroke: "#EEEEEE" }
    }];
    
    let hasTemp = false;
    let hasPercent = false;
    let hasDelta = false;
    
    selectedVariables.forEach(varName => {
        const config = variableConfig[varName];
        if (!config) return;
        
        const seriesConfig = {
            label: config.label,
            stroke: config.color,
            width: config.width,
            scale: config.scale
        };
        
        if (config.dash) {
            seriesConfig.dash = config.dash;
        }
        
        series.push(seriesConfig);
        
        // Track which scales we need
        if (config.scale === "°C") hasTemp = true;
        if (config.scale === "%") hasPercent = true;
        if (config.scale === "Delta") hasDelta = true;
    });
    
    // Add axes for temperature and percent if needed
    if (hasTemp) {
        scales["°C"] = { range: [0, 100] };
        axes.push({
            scale: "°C",
            label: "Temperature",
            grid: { stroke: "#EEEEEE" }
        });
    }
    
    if (hasPercent) {
        scales["%"] = { range: [0, 100] };
        axes.push({
            scale: "%",
            side: 1,
            label: "Valve %",
            grid: { show: false },
            stroke: "#E68A00", // Match Valve color
        });
    }

    if (hasDelta) {
        scales["Delta"] = { range: [-5, 5] };
        axes.push({
            scale: "Delta",
            side: 1,
            label: "Delta °C",
            grid: { show: false },
            stroke: "#B100CD", // Match Delta color
        });
    }
    
    const opts = {
        series: series,
        axes: axes,
        scales: {
            ...scales,
            x: {
                time: false,
                range: (u, min, max) => {
                    if (currentZoom) return currentZoom;
                    const now = latestSimTime;
                    return [Math.max(0, now - timeWindowSeconds), now];
                }
            }
        },
        width: containerWidth,
        height: containerHeight,
        cursor: {
            drag: {
                x: true,
                y: true
            }
        },
        select: {
            show: true,
            over: true
        },
        plugins: [
            tooltipPlugin()
        ]
    };
    
    // Map selected variables to master data indices
    const seriesIndices = [0]; 
    selectedVariables.forEach(varName => {
        if (varName === 'TMilkOutlet') seriesIndices.push(1);
        else if (varName === 'TMilkInlet') seriesIndices.push(2);
        else if (varName === 'TWaterAfterSteam') seriesIndices.push(3);
        else if (varName === 'Valve') seriesIndices.push(4);
        else if (varName === 'ProductSP') seriesIndices.push(5);
        else if (varName === 'SlaveSP') seriesIndices.push(6);
        else if (varName === 'ProductDelta') seriesIndices.push(7);
    });

    // Populate chartData with existing master history for selected variables
    chartData = seriesIndices.map(idx => [...masterChartData[idx]]);
    
    chart = new uPlot(opts, chartData, container);
    
    // Handle select (zoom) event
    chart.over.addEventListener('select', (e) => {
        if (e.detail) {
            const selection = e.detail;
            if (selection.left !== undefined && selection.right !== undefined) {
                currentZoom = [selection.left, selection.right];
            }
        }
    });
    
    // Force set size after creation
    setTimeout(() => {
        if (chart) {
            chart.setSize({
                width: containerWidth,
                height: containerHeight
            });
        }
    }, 0);
    
    // Handle window resize
    window.addEventListener('resize', () => {
        if (chart && container) {
            chart.setSize({
                width: container.offsetWidth,
                height: containerHeight
            });
        }
    });
}

function updateChartVariables(mode) {
    const container = document.getElementById('variable-checkboxes');
    if (!container) return;

    const modeDefaults = {
        'manual': {
            available: ['TMilkOutlet', 'TMilkInlet', 'TWaterAfterSteam', 'Valve', 'ProductDelta'],
            selected: ['TMilkOutlet', 'TMilkInlet', 'TWaterAfterSteam', 'Valve', 'ProductDelta']
        },
        'single': {
            available: ['TMilkOutlet', 'TMilkInlet', 'TWaterAfterSteam', 'Valve', 'ProductSP', 'ProductDelta'],
            selected: ['TMilkOutlet', 'TMilkInlet', 'TWaterAfterSteam', 'Valve', 'ProductSP', 'ProductDelta']
        },
        'cascade': {
            available: ['TMilkOutlet', 'TMilkInlet', 'TWaterAfterSteam', 'Valve', 'ProductSP', 'SlaveSP', 'ProductDelta'],
            selected: ['TMilkOutlet', 'TMilkInlet', 'TWaterAfterSteam', 'Valve', 'ProductSP', 'SlaveSP', 'ProductDelta']
        }
    };

    const config = modeDefaults[mode] || modeDefaults['manual'];
    
    container.innerHTML = '';
    selectedVariables.clear();

    config.available.forEach(varName => {
        const varCfg = variableConfig[varName];
        if (!varCfg) return;

        const label = document.createElement('label');
        
        // 1. Color marker
        const marker = document.createElement('span');
        marker.className = 'color-marker';
        if (varCfg.dash) {
            marker.style.borderBottom = `2px dashed ${varCfg.color}`;
            marker.style.height = '0';
            marker.style.marginTop = '6px';
            marker.style.borderRadius = '0';
            marker.style.borderLeft = marker.style.borderRight = 'none';
        } else {
            marker.style.backgroundColor = varCfg.color;
        }

        // 2. Checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.var = varName;
        if (config.selected.includes(varName)) {
            checkbox.checked = true;
            selectedVariables.add(varName);
        }

        checkbox.addEventListener('change', () => {
            if (checkbox.checked) selectedVariables.add(varName);
            else selectedVariables.delete(varName);
            rebuildChart();
        });

        // 3. Label Text
        const text = document.createTextNode(varCfg.label);

        label.appendChild(marker);
        label.appendChild(checkbox);
        label.appendChild(text);
        
        container.appendChild(label);
    });

    rebuildChart();
}

// ==========================================
// PLC STATE UPDATE HANDLER
// ==========================================

function handleStateUpdate(payload) {
    const { outputs, hmi, inputs } = payload;
    
    lastHmi = hmi;
    lastInputs = inputs;
    lastOutputs = outputs;
    
    updateDisplay(hmi, outputs, inputs);
    
    if (inputs.cfg_ControlMode && inputs.cfg_ControlMode !== currentControlMode) {
        currentControlMode = inputs.cfg_ControlMode;
        updateModeDisplay(currentControlMode);
    }

    const speedState = inputs.cfg_SpeedMultiplier > 0 ? 'running' : 'stopped';
    if (speedState !== currentSpeedState) {
        currentSpeedState = speedState;
        updateModeDisplay(currentSpeedState);
    }
    
    updateChart(hmi, outputs, inputs);
    
    if (requestTestStart) {
        startTest(hmi);
        requestTestStart = false;
    }
    
    if (isTestRunning) {
        handleTestStateMachine(hmi, inputs);
    }
}

function handleSceneReset() {
    if (isTestRunning) {
        isTestRunning = false;
        testInletReached = false;
        testInletLastLogged = -1;
        lastProcessedTestState = -1;
        setTestModeUI(false);
    }
    
    masterChartData = [[], [], [], [], [], [], [], []];
    chartData = [[]];
    selectedVariables.forEach(() => chartData.push([]));
    
    updateModeDisplay('manual');
    
    if (dom.valveSlider) dom.valveSlider.value = 0;
    if (dom.valveSliderValue) dom.valveSliderValue.textContent = '0%';
    
    rebuildChart();
}

plcWorker.onmessage = function(event) {
    const handlers = {
        'PLC_STATE_UPDATE': handleStateUpdate,
        'SCENE_RESET_COMPLETE': handleSceneReset
    };
    handlers[event.data.type]?.(event.data.payload);
};

function updateDisplay(hmi, outputs, inputs) {
    // Update SVG text elements
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
    
    // Update performance displays
    if (dom.iaeDisplay) {
        dom.iaeDisplay.textContent = hmi.score_IAE.toFixed(2);
    }
    if (dom.deltaDisplay) {
        dom.deltaDisplay.textContent = (hmi.vis_ProductDelta || 0).toFixed(2) + ' °C';
        // Add visual color feedback
        const delta = Math.abs(hmi.vis_ProductDelta || 0);
        dom.deltaDisplay.style.color = delta < 0.5 ? '#10b981' : (delta < 2 ? '#f59e0b' : '#ef4444');
    }
    
    // Sync manual slider if not in manual mode
    if (inputs && inputs.cfg_ControlMode !== 'manual' && dom.valveSlider) {
        dom.valveSlider.value = outputs.actuator_SteamValvePercent;
        if (dom.valveSliderValue) {
            dom.valveSliderValue.textContent = outputs.actuator_SteamValvePercent.toFixed(0) + '%';
        }
    }

        if (inputs) {
        syncFieldsFromInputs(inputs);
        
        if (dom.slaveOverrideSp && document.activeElement !== dom.slaveOverrideSp) {
            dom.slaveOverrideSp.checked = inputs.slave_override_sp;
        }
        if (dom.slaveManualSpRow) {
            dom.slaveManualSpRow.classList.toggle('hidden', !inputs.slave_override_sp);
        }
        
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
}

function updateFieldIfNoFocus(element, value) {
    if (element && document.activeElement !== element) {
        element.value = value;
    }
}

function syncFieldsFromInputs(inputs) {
    PID_FIELD_MAPPINGS.forEach(({ domKey, inputKey }) => {
        updateFieldIfNoFocus(dom[domKey], inputs[inputKey]);
    });
}

function bindPidField(domKey, inputKey) {
    const element = dom[domKey];
    if (!element) return;
    element.addEventListener('change', (e) => {
        sendUpdate(inputKey, parseFloat(e.target.value));
    });
}

function bindAllPidFields() {
    PID_FIELD_MAPPINGS.forEach(({ domKey, inputKey }) => {
        bindPidField(domKey, inputKey);
    });
}

// Helper to update text element if foreignObject is hidden/not working
function updateSvgTextFallback(group, text) {
    if (!group) return;
    const textElement = group.querySelector('text');
    if (textElement) {
        textElement.textContent = text;
    }
}

function updateChart(hmi, outputs, inputs) {
    if (isPaused) return;

    // Use simulation time from worker
    const time = hmi.vis_SimulationTime || 0;
    latestSimTime = time;
    
    // 1. Update Master Storage (Always)
    masterChartData[0].push(time);
    masterChartData[1].push(hmi.vis_TMilkOutlet);
    masterChartData[2].push(hmi.vis_TMilkInlet);
    masterChartData[3].push(hmi.vis_TWaterAfterSteam);
    masterChartData[4].push(outputs.actuator_SteamValvePercent);
    
    // Choose active SP based on mode
    let targetSP = DEFAULT_SETPOINT;
    const mode = inputs.cfg_ControlMode || 'manual';
    
    if (mode === 'single') {
        targetSP = (inputs.single_SP !== undefined) ? inputs.single_SP : DEFAULT_SETPOINT;
    } else {
        targetSP = (inputs.master_SP !== undefined) ? inputs.master_SP : DEFAULT_SETPOINT;
    }
    
    const delta = hmi.vis_ProductDelta !== undefined ? hmi.vis_ProductDelta : 0;

    masterChartData[5].push(targetSP); 
    masterChartData[6].push(outputs.master_Output || 0); // Slave SP in Cascade
    masterChartData[7].push(delta); // Product Delta (PV - SP) from worker

    // Keep buffer limits (2000s @ 100Hz = 200000 points)
    if (masterChartData[0].length > CHART_MAX_BUFFER_POINTS) {
        masterChartData.forEach(series => series.shift());
    }

    if (!chart) return;

    // 2. Map new data to currently active chart series
    // Map of variable name to its index in masterChartData
    const varToIndex = {
        'TMilkOutlet': 1,
        'TMilkInlet': 2,
        'TWaterAfterSteam': 3,
        'Valve': 4,
        'ProductSP': 5,
        'SlaveSP': 6,
        'ProductDelta': 7
    };

    const currentDataPoint = [time];
    selectedVariables.forEach(varName => {
        currentDataPoint.push(masterChartData[varToIndex[varName]].slice(-1)[0]);
    });

    // Push to current chartData buffer
    for (let i = 0; i < chartData.length; i++) {
        chartData[i].push(currentDataPoint[i]);
    }

    // Keep active buffer in sync with master size
    if (chartData[0].length > CHART_MAX_BUFFER_POINTS) {
        chartData.forEach(series => series.shift());
    }
    
    // 3. Update Chart Viewport (Sliding Window or Zoom)
    if (!currentZoom) {
        // Sliding window logic
        const maxTime = time;
        const minTime = Math.max(0, time - timeWindowSeconds);
        
        chart.setScale('x', { min: minTime, max: maxTime });
    } else {
        // Managed by uPlot zoom/select
        const [zoomMin, zoomMax] = currentZoom;
        chart.setScale('x', { min: zoomMin, max: zoomMax });
    }
    
    // Always provide the full buffer, uPlot optimizes rendering based on scales
    chart.setData(chartData);
}

// = : =========================================
// EVENT LISTENERS
// ==========================================

function sendUpdate(key, value) {
    if (isNaN(value)) return;
    plcWorker.postMessage({
        type: 'WRITE_INPUTS',
        payload: { [key]: value }
    });
}

function startTest(hmi) {
    if (isTestRunning) return;
    isTestRunning = true;
    testState = 1;
    testStageTimer = 0;
    testSettledTimer = 0;
    previousSimTime = hmi.vis_SimulationTime;
    testStartTime = hmi.vis_SimulationTime;
    testInletReached = false;
    testInletLastLogged = -1;
    lastProcessedTestState = -1;
    
    disturbanceFlags |= 0x02;
    disturbanceFlags &= ~0x01;
    
    const mode = currentControlMode || 'unknown';
    const sp = (mode === 'single') ? lastInputs?.single_SP : lastInputs?.master_SP;
    console.log(`%c[TEST] +0.0s ========== STARTED ==========`, 'color: #f59e0b; font-weight: bold');
    console.log(`[TEST] +0.0s Mode: ${mode} | SP: ${sp}°C | Initial Delta: ${hmi.vis_ProductDelta?.toFixed(2)}°C`);
    console.log(`[TEST] +0.0s Disturbances: ValveWear=2.5%, PressureNoise=0.5 BAR`);
    
    plcWorker.postMessage({
        type: 'WRITE_INPUTS',
        payload: { dist_ValveWear: 2.5, dist_PressureNoise: 0.5, cmd_DisturbanceFlags: disturbanceFlags }
    });

    if (dom.distValveWear) dom.distValveWear.value = 2.5;
    if (dom.distValveWearValue) dom.distValveWearValue.textContent = '2.5%';
    if (dom.distPressureNoise) dom.distPressureNoise.value = 0.5;
    if (dom.distPressureNoiseValue) dom.distPressureNoiseValue.textContent = '0.50';
    if (dom.distPressureDrop) dom.distPressureDrop.classList.remove('active');
    
    plcWorker.postMessage({ type: 'RESET_IAE' });
    setTestModeUI(true);
    const speed = lastInputs?.cfg_SpeedMultiplier ?? 1;
    const speedLabel = speed === 0 ? 'Pause (0x)' :
                       speed === 1 ? 'Normal (1x)' :
                       speed === 2 ? 'Quick (2x)' :
                       speed === 5 ? 'Fast (5x)' :
                       speed === 10 ? 'Turbo (10x)' :
                       speed === 20 ? 'Ludicrous (20x)' : `${speed}x`;
    console.log(`[TEST] +0.0s Simulation speed = ${speedLabel}`);
    console.log(`[TEST] +0.0s Phase 1: Inlet to 5°C (waiting ${TEST_SETTLED_DURATION}s with |delta|<${TEST_SETTLED_THRESHOLD}°C)`);
    console.log(`[TEST] +0.0s Test sequence: 4 phases + boiler failure`);
    console.log(`[TEST] +0.0s Settled threshold: ${TEST_SETTLED_THRESHOLD}°C`);
}

const TEST_PHASES = [
    { name: 'Inlet to 5°C', inletTemp: 5, timeout: TEST_PHASE_TIMEOUT.stabilize, nextLog: 'Stabilizing at 5°C inlet' },
    { name: 'Cold Product 5°C', inletTemp: 5, timeout: TEST_PHASE_TIMEOUT.product, nextLog: 'Testing at 5°C (Cold Product)' },
    { name: 'Water 15°C', inletTemp: 15, timeout: TEST_PHASE_TIMEOUT.water, nextLog: 'Inlet → 15°C (Water)' },
    { name: 'Boiler Failure', inletTemp: 15, boilerFail: true, timeout: TEST_PHASE_TIMEOUT.boiler, nextLog: 'Boiler Failure ON' }
];

function handleTestStateMachine(hmi, inputs) {
    if (!isTestRunning) return;
    
    let dt = hmi.vis_SimulationTime - previousSimTime;
    if (dt < 0) dt = 0;
    previousSimTime = hmi.vis_SimulationTime;
    testStageTimer += dt;
    
    const elapsed = (hmi.vis_SimulationTime - testStartTime).toFixed(1);
    const phaseIndex = testState - 1;
    
    if (testState !== lastProcessedTestState) {
        if (testState >= 1 && testState <= 4) {
            const phase = TEST_PHASES[testState - 1];
            if (phase.inletTemp !== undefined) {
                plcWorker.postMessage({ type: 'WRITE_INPUTS', payload: { dist_InletTempSP: phase.inletTemp } });
                if (dom.distInletTemp) dom.distInletTemp.value = phase.inletTemp;
                console.log(`[TEST] +${elapsed}s → Setting inlet target to ${phase.inletTemp}°C`);
            }
        }
        lastProcessedTestState = testState;
    }
    
    if (testState >= 1 && testState <= 4) {
        const phase = TEST_PHASES[phaseIndex];
        const remaining = Math.max(0, TEST_SETTLED_DURATION - testStageTimer).toFixed(0);
        
        if (dom.runTestBtn) dom.runTestBtn.textContent = `Test: ${phase.name} (${remaining}s)`;
        
        if (phase.inletTemp !== undefined && !testInletReached) {
            const inletDelta = Math.abs(hmi.vis_TMilkInlet - phase.inletTemp);
            const currentSecond = Math.floor(testStageTimer);
            if (testInletLastLogged !== currentSecond) {
                console.log(`[TEST] +${elapsed}s Inlet TT202=${hmi.vis_TMilkInlet?.toFixed(1)}°C → target=${phase.inletTemp}°C (Δ=${inletDelta.toFixed(1)}°C)`);
                testInletLastLogged = currentSecond;
            }
            if (inletDelta < 0.5) {
                console.log(`[TEST] +${elapsed}s ✓ Inlet reached target ${phase.inletTemp}°C`);
                testInletReached = true;
            }
        }
        
        if (testInletReached || phase.inletTemp === undefined) {
            testSettledTimer = Math.abs(hmi.vis_ProductDelta) < TEST_SETTLED_THRESHOLD ? testSettledTimer + dt : 0;
        }
        
        if (testSettledTimer >= TEST_SETTLED_DURATION || (testStageTimer > phase.timeout && Math.abs(hmi.vis_ProductDelta) < TEST_SETTLED_THRESHOLD)) {
            console.log(`[TEST] +${elapsed}s Phase ${testState}: ${phase.name} settled | delta=${hmi.vis_ProductDelta?.toFixed(2)}°C | valve=${lastOutputs?.actuator_SteamValvePercent?.toFixed(0)}% | inlet=${hmi.vis_TMilkInlet?.toFixed(1)}°C`);
            console.log(`[TEST] +${elapsed}s Phase ${testState} → ${testState + 1}: ${phase.nextLog}`);
            
            testState++;
            testStageTimer = 0;
            testSettledTimer = 0;
            testInletReached = false;
            testInletLastLogged = -1;
            
            if (phase.boilerFail) {
                disturbanceFlags |= 0x01;
                plcWorker.postMessage({ type: 'WRITE_INPUTS', payload: { cmd_DisturbanceFlags: disturbanceFlags } });
                if (dom.distPressureDrop) dom.distPressureDrop.classList.add('active');
            }
        }
    }
    else if (testState === 5) {
        if (dom.runTestBtn) dom.runTestBtn.textContent = `Test: Boiler Fail (${testStageTimer.toFixed(0)}s)`;
        
        if (testStageTimer >= TEST_PHASE_TIMEOUT.boiler) {
            const finalScore = dom.iaeDisplay ? dom.iaeDisplay.textContent : 'Unknown';
            const totalDuration = hmi.vis_SimulationTime - testStartTime;
            
            console.log(`[TEST] +${elapsed}s Phase 5: Boiler Fail | Pressure=${hmi.vis_SteamPressure?.toFixed(1)} Bar | delta=${hmi.vis_ProductDelta?.toFixed(2)}°C`);
            console.log(`%c[TEST] +${elapsed}s ========== COMPLETED ==========`, 'color: #10b981; font-weight: bold');
            console.log(`[TEST] +${elapsed}s Final IAE Score: ${finalScore}`);
            console.log(`[TEST] +${elapsed}s Total Duration: ${totalDuration?.toFixed(1)}s`);
            console.log(`[TEST] ==================================`);
            
            isTestRunning = false;
            setTestModeUI(false);
            
            setTimeout(() => {
                showScoreModal(finalScore, currentControlMode, totalDuration?.toFixed(1));
            }, 100);
            if (dom.runTestBtn) dom.runTestBtn.textContent = `Run Test`;
        }
    }
}

function setTestModeUI(active) {
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

function setupEventListeners() {
    setupValveControls();
    setupModeButtons();
    setupSpeedSelector();
    setupResetButtons();
    setupTestButton();
    bindAllPidFields();
    setupSlaveOverrideControls();
    setupDisturbanceControls();
    setupSvgInteractivity();
}

function setupValveControls() {
    if (dom.valveSlider) {
        dom.valveSlider.addEventListener('input', (e) => {
            const newVal = parseFloat(e.target.value);
            if (isNaN(newVal)) return;
            if (dom.valveSliderValue) dom.valveSliderValue.textContent = newVal + '%';
            sendUpdate('cmd_ValveManualPercent', newVal);
        });
    }
}

function setupModeButtons() {
    const modes = ['manual', 'single', 'cascade'];
    modes.forEach(mode => {
        const btn = dom[mode + 'Btn'];
        if (btn) {
            btn.addEventListener('click', () => {
                plcWorker.postMessage({ type: 'WRITE_INPUTS', payload: { cfg_ControlMode: mode } });
                updateModeDisplay(mode);
            });
        }
    });
}

function setupSpeedSelector() {
    if (dom.speedSelector) {
        dom.speedSelector.addEventListener('change', (e) => {
            const speed = parseInt(e.target.value);
            const speedLabel = speed === 0 ? 'Pause (0x)' :
                               speed === 1 ? 'Normal (1x)' :
                               speed === 2 ? 'Quick (2x)' :
                               speed === 5 ? 'Fast (5x)' :
                               speed === 10 ? 'Turbo (10x)' :
                               speed === 20 ? 'Ludicrous (20x)' : `${speed}x`;
            plcWorker.postMessage({ type: 'WRITE_INPUTS', payload: { cfg_SpeedMultiplier: speed } });
            updateModeDisplay(speed > 0 ? 'running' : 'stopped');
            console.log(`[SYSTEM] Simulation speed changed to ${speedLabel}`);
        });
    }
}

function setupResetButtons() {
    if (dom.resetBtn) {
        dom.resetBtn.addEventListener('click', () => plcWorker.postMessage({ type: 'RESET_SCENE' }));
    }
    if (dom.resetIaeBtn) {
        dom.resetIaeBtn.addEventListener('click', () => plcWorker.postMessage({ type: 'RESET_IAE' }));
    }
}

function setupTestButton() {
    if (!dom.runTestBtn) return;
    dom.runTestBtn.addEventListener('click', () => {
        if (isTestRunning) return;
        const mode = currentControlMode || 'manual';
        const currentSP = (mode === 'single') ? lastInputs?.single_SP : lastInputs?.master_SP;
        const delta = Math.abs(lastHmi?.vis_ProductDelta ?? 999);
        
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
        requestTestStart = true;
    });
}

function setupSlaveOverrideControls() {
    if (dom.slaveOverrideSp) {
        dom.slaveOverrideSp.addEventListener('change', (e) => {
            plcWorker.postMessage({ type: 'WRITE_INPUTS', payload: { slave_override_sp: e.target.checked } });
        });
    }
}

function setupDisturbanceControls() {
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
            sendUpdate('dist_PressureNoise', val);
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

function setupSvgInteractivity() {
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
                sendUpdate(key, val);
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
                updateModeDisplay('manual');
            }
        });
    }
}

// ==========================================
// MODE DISPLAY UPDATE
// ==========================================

function updateModeDisplay(mode) {
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
            if (dom.manualBtn) dom.manualBtn.classList.add('active');
            if (dom.singleBtn) dom.singleBtn.classList.remove('active');
            if (dom.cascadeBtn) dom.cascadeBtn.classList.remove('active');
            if (dom.runTestBtn && !isTestRunning) dom.runTestBtn.disabled = true;
            updateChartVariables('manual');
            switchPidPanel('manual');
            break;
        case 'single':
            dom.controlModeDisplay.textContent = 'Auto Control';
            dom.pidModeDisplay.textContent = '1 PID';
            if (dom.manualBtn) dom.manualBtn.classList.remove('active');
            if (dom.singleBtn) dom.singleBtn.classList.add('active');
            if (dom.cascadeBtn) dom.cascadeBtn.classList.remove('active');
            if (dom.runTestBtn && !isTestRunning) dom.runTestBtn.disabled = false;
            updateChartVariables('single');
            switchPidPanel('single');
            break;
        case 'cascade':
            dom.controlModeDisplay.textContent = 'Auto Control';
            dom.pidModeDisplay.textContent = 'Cascade';
            if (dom.manualBtn) dom.manualBtn.classList.remove('active');
            if (dom.singleBtn) dom.singleBtn.classList.remove('active');
            if (dom.cascadeBtn) dom.cascadeBtn.classList.add('active');
            if (dom.runTestBtn && !isTestRunning) dom.runTestBtn.disabled = false;
            updateChartVariables('cascade');
            switchPidPanel('cascade');
            break;
    }
}

function switchPidPanel(mode) {
    if (mode === 'single' || mode === 'manual') {
        if (dom.panelSingle) dom.panelSingle.classList.remove('hidden');
        if (dom.panelCascade) dom.panelCascade.classList.add('hidden');
    } else if (mode === 'cascade') {
        if (dom.panelSingle) dom.panelSingle.classList.add('hidden');
        if (dom.panelCascade) dom.panelCascade.classList.remove('hidden');
    }
}

// ==========================================
// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    console.log('HMI DOMContentLoaded');
    
    initFirebase();
    setupModalEventListeners();
    
    // Small delay to ensure SVG is fully loaded
    setTimeout(() => {
        cacheDOM();
        initChart();
        setupEventListeners();
        
        // Initialize displays with default values
        initializeDisplays();
        
        // Sync UI with initial worker state
        updateModeDisplay('manual'); 
        updateModeDisplay('running'); // Always running by default
        
        initUITooltips();
        
        console.log('HMI Initialized (Always-on Simulation)');
    }, 100);
});

function initializeDisplays() {
    console.log('Initializing displays...');
    
    // Initialize temperature displays
    if (dom.prodTempGroup) {
        const tempText = '20.0 °C';
        if (dom.prodTempText) dom.prodTempText.textContent = tempText;
        updateSvgTextFallback(dom.prodTempGroup, tempText);
    }
    
    if (dom.prodTempInGroup) {
        const tempText = '20.0 °C';
        if (dom.prodTempInText) dom.prodTempInText.textContent = tempText;
        updateSvgTextFallback(dom.prodTempInGroup, tempText);
    }
    
    if (dom.heatWaterTempGroup) {
        const tempText = '55.0 °C';
        if (dom.heatWaterTempText) dom.heatWaterTempText.textContent = tempText;
        updateSvgTextFallback(dom.heatWaterTempGroup, tempText);
    }
    
    if (dom.propValveCvGroup) {
        const valveText = '0%';
        if (dom.propValveText) dom.propValveText.textContent = valveText;
        updateSvgTextFallback(dom.propValveCvGroup, valveText);
    }
    
    // Initialize IAE display
    if (dom.iaeDisplay) {
        dom.iaeDisplay.textContent = '0.00';
    }
    
    // Initialize slider value
    if (dom.valveSliderValue) {
        dom.valveSliderValue.textContent = '0%';
    }
}

// OLD CODE (kept for reference):
// document.addEventListener('DOMContentLoaded', () => {
//     cacheDOM();
//     initChart();
//     setupEventListeners();
//     console.log('HMI Initialized');
// });
