# PID Cascade Simulator - Pasteurizer

Browser-based interactive simulator demonstrating cascade PID control advantages over single-loop control for PLC engineers in pasteurization processes.

## Features

- **Continuous physics simulation** in Web Worker (PLC Controller)
- **Interactive SVG HMI** with direct parameter input
- **Single-loop vs cascade PID comparison**
- **IAE (Integral Absolute Error) scoring** with "touch-startup" logic
- **Unified Control Modes** (Manual, Single, Cascade)
- **Sliding Time Window** charting (no "accordion" effect)
- **Interactive chart tooltip**: Hold **ALT** over the chart to see a vertical slice of all current values.
- **Color-Coded Variable Selection**: Easily toggle variables on the chart using the color-matched selection grid.
- **Scientific Engineering Hints**: Hold **ALT** while hovering over any control parameter (Kp, Ti, Td, etc.) to see a detailed technical explanation of its function.
- **Configurable disturbances** (Valve wear deadband, Wandering pressure noise, Pressure drops)
- **Siemens PID Compact** implementation with all features:
  - Anti-windup protection
  - Bumpless transfer
  - Setpoint weighting (b, a)
  - Derivative filtering
  - Output limiting
  - **Deadband support** (configurable per PID)

## Architecture

The simulator uses a **Web Worker** as a PLC controller and the main thread as an HMI/SCADA interface:

```
┌─────────────────────────────────────────────────────────────┐
│                    MAIN THREAD (HMI/SCADA)                   │
│  main.js: DOM updates, uPlot charts, user input handling     │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ postMessage
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    WEB WORKER (PLC CONTROLLER)                │
│  worker.js: Data Blocks, PID, Scan Cycle (10ms)              │
│  process.js: Physics Model, Transport Delays, Disturbances   │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Modern browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- Screen resolution: 1280×720 minimum
- Web Worker support required

### Installation

1. **Download uPlot library** (required for charts):
   - Go to: https://github.com/leeoniya/uPlot/releases
   - Download the latest `uPlot.min.js` and `uplot.min.css`
   - Place them in `lib/` directory

2. **Open the simulator**:
   - Simply open `index.html` in your browser
   - No build process or dependencies required!

### Basic Usage

The simulation starts **automatically** upon loading.

#### Manual Mode

1. Click **Manual** button.
2. Use the **Valve Position** slider (0-100%) or click directly on the valve in the SVG diagram to set its position.
3. Observe temperature changes on the HMI diagram and charts.

#### Auto Mode - 1 PID (Single Loop)

1. Click **1 PID** button.
2. Set the **SP (Setpoint)** temperature (default: 72°C) in the control panel or by clicking the product outlet sensor on the SVG.
3. Adjust PID parameters (Kp, Ti, Td, Deadband) to tune the response.
4. Observe the PID controller maintaining the setpoint by manipulating the valve.

#### Auto Mode - Cascade PID

1. Click **Cascade PID** button.
2. The system now uses two nested PID loops:
   - **Outer Loop (Master)**: Controls milk temperature by providing a setpoint for steam pressure.
   - **Inner Loop (Slave)**: Controls steam pressure for faster rejection of supply disturbances.
3. Compare response with Single Loop mode when applying disturbances.

#### Simulation Speed (Total Speed Multiplier)

- **Pause (0x)**: Freezes the simulation state.
- **Normal (1x)**: Standard execution speed.
- **Quick (2x)**: 2x speed.
- **Fast (5x)**: 5x speed.
- **Turbo (10x)**: 10x speed.
- **Ludicrous (20x)**: 20x speed for long-term stability testing.

#### Disturbances

Test the control system's robustens:
- **Boiler Failure**: Simulates a complete loss of steam supply. Pressure gradually drops from 3 BAR to 0 BAR over 30 seconds.
- **Valve Wear (Deadband)**: Adds mechanical deadband (0-5%) where small valve commands are ignored.
- **Pressure Noise (±BAR)**: Randomly wandering supply pressure (0-1 BAR) simulating other plant loads.

## Control Panel

### Mode Controls
- **Manual / 1 PID / Cascade PID**: Switchbetween direct control and automated PID strategies.
- **Total Speed Multiplier**: Adjust simulation tempo or pause.
- **Reset Scene**: Resets physics and time to zero, but **keeps your PID tuning and coefficients**.

### PID Parameters

#### Master PID (Temperature Control)
- **Kp**: Proportional gain (0.1-10)
- **Ti (s)**: Integral time (0.1-1000s). Protective: Ti < 0.001 disables I-action.
- **Td (s)**: Derivative time (0-100s)
- **Deadband (°C)**: Range around SP where the controller freezes output to prevent actuator chatter.
- **SP (°C)**: Temperature setpoint (60-85°C)

#### Slave PID (Steam Control)
- **Kp**: Proportional gain (0.1-20)
- **Ti (s)**: Integral time (0.1-500s)
- **Td (s)**: Derivative time (0-50s)

### Manual Valve Control
- **Valve Position (%)**: Direct valve control in manual mode (0-100%)

### Disturbances
- **Boiler Failure**: Toggle gradual boiler shutdown (pressure ramp-down)
- **Valve Wear (Deadband)**: Range (0-5%) of valve command changes that the mechanical actuator ignores.
- **Pressure Noise (±BAR)**: Magnitude (0-1 BAR) of random-walk pressure fluctuations.

### Performance
- **IAE (Error Sum)**: Accumulated absolute error. Note: After **Reset Scene**, counting only starts once the temperature (PV) first touches the setpoint (SP). **Important**: Differences within ±1.0°C are ignored and do not increase the score.
- **Reset (IAE)**: Manually reset the score counter at any time.

## PID Tuning Guide

### Single Loop Tuning

1. **Start with conservative values**:
   - Kp = 1.0, Ti = 10.0, Td = 0.0

2. **Increase Kp** until you see oscillations
   - Typical range: 1.0-3.0

3. **Adjust Ti** to eliminate steady-state error
   - Typical range: 2.0-6.0 seconds
   - Lower Ti = faster integral action

4. **Add Td** to reduce overshoot
   - Typical range: 0.0-1.0 seconds
   - Higher Td = more damping

### Cascade Tuning

1. **Tune Slave PID first** (Inner Loop - Steam Control):
   - Kp = 3.0-7.0
   - Ti = 1.0-3.0 seconds
   - Td = 0.0-0.2 seconds

2. **Tune Master PID** (Outer Loop - Temperature Control):
   - Kp = 1.5-2.5
   - Ti = 3.0-5.0 seconds
   - Td = 0.0-1.0 seconds

### Recommended Tuning

| Mode | Kp | Ti (s) | Td (s) | Description |
|------|-----|-------|-------|-------------|
| Single - Conservative | 1.5 | 5.0 | 0.0 | Slow, no overshoot |
| Single - Balanced | 2.0 | 4.0 | 0.5 | Good response |
| Single - Aggressive | 3.0 | 3.0 | 1.0 | Fast, some overshoot |
| Cascade - Slave | 5.0 | 2.5 | 0.1 | Inner loop |
| Cascade - Master | 2.0 | 4.0 | 0.5 | Outer loop |

## Performance Metrics

### Single Loop vs Cascade

| Metric | Single Loop | Cascade |
|--------|-------------|---------|
| Settling time | 20-30s | 15-20s |
| Overshoot | 5-10% | 2-5% |
| Disturbance rejection | Moderate | Excellent |
| IAE score | Higher | Lower |

### System Performance

- **Physics step**: 10ms (100 Hz)
- **PID execution**: 40ms (25 Hz)
- **UI refresh**: 60 FPS
- **CPU usage**: < 30%
- **Memory**: < 100MB

## File Structure

```
pid-cascade/
├── worker.js           # PLC Controller (Data Blocks, PID, Scan Cycle)
├── process.js          # Physics Model (Heat Exchanger, disturbances)
├── main.js             # HMI/SCADA (DOM updates, uPlot charts)
├── index.html          # Main HTML file
├── LICENSE             # MIT License
├── .gitignore          # Git ignore rules
├── firestore.rules     # Firebase security rules (documentation)
├── css/
│   └── styles.css      # HMI styling
├── lib/
│   └── uplot.min.js    # uPlot library (download required)
├── img/
│   └── HeatExchanger.svg # HMI diagram
├── tests/
│   └── manual-test-checklist.md # Testing guide
├── technical_specification.md # Detailed technical specs
└── README.md           # This file
```

## Troubleshooting

### uPlot Not Loading

**Problem**: Chart not displaying, showing placeholder message.

**Solution**: Download the real `uPlot.min.js` from GitHub releases and place it in the `lib/` directory.

### Worker Not Starting

**Problem**: Console error "Worker not initialized".

**Solution**: 
- Check browser console for errors
- Verify worker.js is in the same directory as index.html
- Ensure Web Workers are supported in your browser

### Performance Issues

**Problem**: UI lagging, low FPS.

**Solution**:
- Reduce simulation speed (use 1x instead of 10x)
- Close other browser tabs
- Check CPU usage
- Reduce chart data points (currently 60s rolling window)

### Temperature Not Responding

**Problem**: Temperatures not changing when valve moves.

**Solution**:
- Check if simulation is running (Start button)
- Verify speed multiplier is not 0
- Check console for errors
- Ensure process.js is loaded (importScripts)

## Technical Details

For detailed technical specifications, see `technical_specification.md`.

### PID Algorithm

The continuous-time formula for the internal PID output $u(t)$ is represented as:

```
u(t) = Kp × [eP(t)] + (1/Ti)×∫e(t)dt + Td × d[eD(t)]/dt

Where:
- e(t) = SP - PV (basic error for the integral part)
- eP(t) = b×SP - PV (error with P-action weighting)
- eD(t) = a×SP - PV (error with D-action weighting)
- b = P-action weighting coefficient (0.0 to 1.0)
- a = D-action weighting coefficient (0.0 to 1.0)
```

The algorithm includes **Setpoint Limits** (High/Low) to clamp the target SP before calculation, and a **Derivative delay coefficient (c)** (a PT1 low-pass filter) applied to the D-part to prevent high-frequency sensor noise from causing aggressive output jitter.

In **Cascade Mode**, the **Master** and **Slave** PID controllers use identical structure and code. The Master controls the primary slow process and outputs a dynamic setpoint to the Slave. The Slave uses that setpoint to control a fast-reacting secondary process (e.g., steam pressure) by directly driving the final control element.

### Physics Model

Heat exchanger model uses first-order lag with transport delay:

```
Transfer function: G(s) = K / (τ·s + 1) · e^(-L·s)

Where:
- K = Heat transfer coefficient
- τ = Time constant
- L = Transport delay
```

### Firebase Security

The leaderboard feature uses Firebase Firestore with security rules that:

- **Allow read access** to all users for the leaderboard collection
- **Validate all writes** to ensure only valid data (name, score, mode, timestamp, date) can be created
- **Prevent updates and deletions** to protect against score manipulation
- **Restrict all other collections** for security

See `firestore.rules` for the complete security configuration deployed in Firebase Console.

## Testing

For manual testing guidelines, see `tests/manual-test-checklist.md`.

### Basic Test Sequence

1. Open `index.html`.
2. Observe that simulation is already **Running** and temperatures are updating.
3. Test **Manual** mode: Move the "Y101" valve slider or click the valve in SVG.
4. Test **1 PID** mode: Change Setpoint (SP) and wait for the system to settle.
5. Test **Cascade PID** mode: Compare performance with 1 PID during a **Steam Pressure Drop** disturbance.
6. Test **Total Speed Multiplier**: Try 5x or 10x for long-duration tuning tests.
7. Check **uPlot** charts for the sliding time window behavior.
8. **Interactive values**: Hover over the chart and hold **ALT** to see exact values for all pens at that time.
9. **Technical help**: Hover over any PID parameter or disturbance setting and hold **ALT** to see an engineering description.

## Development

### Technology Stack

- **Vanilla JavaScript** (ES6+)
- **Web Worker API** (PLC Controller Logic)
- **uPlot** (High-performance 2D canvas charting)
- **SVG Interactivity** (Custom HMI Logic)

## License

MIT License - see [LICENSE](LICENSE) file.

## Author

Created by [ArthurkaX](https://github.com/ArthurkaX) for PLC engineers and automation specialists to demonstrate modern process control techniques.

---

**Version**: 1.2.0  
**Last Updated**: 2026-03-21  
**Status**: Interactive Prototype Complete
