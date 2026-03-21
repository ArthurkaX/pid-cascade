// ==========================================
// CHART.JS - uPlot Chart & Tooltip
// ==========================================

let chart = null;
let selectedVariables = new Set();
let isAltPressed = false;
let timeWindowSeconds = DEFAULT_TIME_WINDOW;
let currentZoom = null;
let latestSimTime = 0;

const VARIABLE_CONFIG = CHART_VARIABLE_CONFIG;

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

                u.over.addEventListener('mousemove', e => {
                    isAltPressed = e.altKey;
                    if (isAltPressed && u.cursor.idx != null) {
                        updateTooltip(u, u.cursor.left, u.cursor.top, u.cursor.idx);
                    } else if (!isAltPressed) {
                        tooltip.style.display = "none";
                    }
                });

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

function initChart(masterChartData, chartData, dom) {
    updateChartVariables('manual');

    const timeWindowSelect = document.getElementById('time-window');
    if (timeWindowSelect) {
        timeWindowSelect.addEventListener('change', (e) => {
            timeWindowSeconds = parseInt(e.target.value);
            currentZoom = null;
            if (chart && chartData[0].length > 0) {
                const latestTime = chartData[0][chartData[0].length - 1];
                const minTime = latestTime - timeWindowSeconds;
                
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
    
    const pauseBtn = document.getElementById('btn-pause-chart');
    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            const isPaused = pauseBtn.textContent !== 'Pause';
            pauseBtn.textContent = isPaused ? 'Pause' : 'Resume';
            pauseBtn.classList.toggle('btn-primary', !isPaused);
            pauseBtn.classList.toggle('btn-secondary', isPaused);
        });
    }
    
    const resetZoomBtn = document.getElementById('btn-reset-zoom');
    if (resetZoomBtn) {
        resetZoomBtn.addEventListener('click', () => {
            currentZoom = null;
            if (chart) {
                rebuildChart(masterChartData, chartData);
            }
        });
    }
    
    rebuildChart(masterChartData, chartData);
}

function rebuildChart(masterChartData, chartData) {
    if (chart) {
        chart.destroy();
        chart = null;
    }
    
    const container = document.getElementById('chart-container');
    const containerWidth = container.offsetWidth;
    const containerHeight = 500;
    
    const series = [{ label: "Time (s)" }];
    const scales = {};
    const axes = [{ grid: { stroke: "#EEEEEE" } }];
    
    let hasTemp = false;
    let hasPercent = false;
    let hasDelta = false;
    
    selectedVariables.forEach(varName => {
        const config = VARIABLE_CONFIG[varName];
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
        
        if (config.scale === "°C") hasTemp = true;
        if (config.scale === "%") hasPercent = true;
        if (config.scale === "Delta") hasDelta = true;
    });
    
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
            stroke: "#E68A00",
        });
    }

    if (hasDelta) {
        scales["Delta"] = { range: [-5, 5] };
        axes.push({
            scale: "Delta",
            side: 1,
            label: "Delta °C",
            grid: { show: false },
            stroke: "#B100CD",
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
            drag: { x: true, y: true }
        },
        select: {
            show: true,
            over: true
        },
        plugins: [tooltipPlugin()]
    };
    
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

    chartData.length = 0;
    seriesIndices.forEach(idx => chartData.push([...masterChartData[idx]]));
    
    chart = new uPlot(opts, chartData, container);
    
    chart.over.addEventListener('select', (e) => {
        if (e.detail) {
            const selection = e.detail;
            if (selection.left !== undefined && selection.right !== undefined) {
                currentZoom = [selection.left, selection.right];
            }
        }
    });
    
    setTimeout(() => {
        if (chart) {
            chart.setSize({ width: containerWidth, height: containerHeight });
        }
    }, 0);
    
    window.addEventListener('resize', () => {
        if (chart && container) {
            chart.setSize({ width: container.offsetWidth, height: containerHeight });
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
        const varCfg = VARIABLE_CONFIG[varName];
        if (!varCfg) return;

        const label = document.createElement('label');
        
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
            rebuildChart(masterChartData, chartData);
        });

        const text = document.createTextNode(varCfg.label);

        label.appendChild(marker);
        label.appendChild(checkbox);
        label.appendChild(text);
        
        container.appendChild(label);
    });

    rebuildChart(masterChartData, chartData);
}

function updateChart(hmi, outputs, inputs, masterChartData, chartData) {
    const pauseBtn = document.getElementById('btn-pause-chart');
    const isPaused = pauseBtn && pauseBtn.textContent !== 'Pause';
    
    if (isPaused) return;

    const time = hmi.vis_SimulationTime || 0;
    latestSimTime = time;
    
    masterChartData[0].push(time);
    masterChartData[1].push(hmi.vis_TMilkOutlet);
    masterChartData[2].push(hmi.vis_TMilkInlet);
    masterChartData[3].push(hmi.vis_TWaterAfterSteam);
    masterChartData[4].push(outputs.actuator_SteamValvePercent);
    
    let targetSP = DEFAULT_SETPOINT;
    const mode = inputs.cfg_ControlMode || 'manual';
    
    if (mode === 'single') {
        targetSP = (inputs.single_SP !== undefined) ? inputs.single_SP : DEFAULT_SETPOINT;
    } else {
        targetSP = (inputs.master_SP !== undefined) ? inputs.master_SP : DEFAULT_SETPOINT;
    }
    
    const delta = hmi.vis_ProductDelta !== undefined ? hmi.vis_ProductDelta : 0;

    masterChartData[5].push(targetSP); 
    masterChartData[6].push(outputs.master_Output || 0);
    masterChartData[7].push(delta);

    if (masterChartData[0].length > CHART_MAX_BUFFER_POINTS) {
        masterChartData.forEach(series => series.shift());
    }

    if (!chart) return;

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

    for (let i = 0; i < chartData.length; i++) {
        chartData[i].push(currentDataPoint[i]);
    }

    if (chartData[0].length > CHART_MAX_BUFFER_POINTS) {
        chartData.forEach(series => series.shift());
    }
    
    if (!currentZoom) {
        const maxTime = time;
        const minTime = Math.max(0, time - timeWindowSeconds);
        chart.setScale('x', { min: minTime, max: maxTime });
    } else {
        const [zoomMin, zoomMax] = currentZoom;
        chart.setScale('x', { min: zoomMin, max: zoomMax });
    }
    
    chart.setData(chartData);
}

function getChart() {
    return chart;
}

function getSelectedVariables() {
    return selectedVariables;
}

function getIsPaused() {
    const pauseBtn = document.getElementById('btn-pause-chart');
    return pauseBtn && pauseBtn.textContent !== 'Pause';
}

function setTimeWindow(seconds) {
    timeWindowSeconds = seconds;
}

function resetZoom() {
    currentZoom = null;
}

function clearChartData(masterChartData, chartData) {
    masterChartData = [[], [], [], [], [], [], [], []];
    chartData = [[]];
    selectedVariables.forEach(() => chartData.push([]));
}
