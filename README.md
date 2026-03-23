# PID Cascade Simulator - Pasteurizer

Browser-based interactive simulator demonstrating cascade PID control advantages over single-loop control for pasteurization processes.

**Live Demo:** https://arthurkax.github.io/pid-cascade/

## How to Use

Simply open the simulator in your browser - no installation required. The simulation starts automatically.

## Control Modes

### Manual Mode
1. Click **Manual** button
2. Use the **Valve Position** slider (0-100%) or click the valve in the diagram
3. Observe temperature changes on the HMI and charts

### Auto Mode - 1 PID (Single Loop)
1. Click **1 PID** button
2. Set the **SP (Setpoint)** temperature (default: 72°C)
3. Adjust PID parameters to tune the response
4. Watch the PID maintain the setpoint by controlling the valve

### Auto Mode - Cascade PID
1. Click **Cascade PID** button
2. The system uses two nested PID loops:
   - **Outer Loop (Master)**: Controls milk temperature by setting steam pressure
   - **Inner Loop (Slave)**: Controls steam pressure for faster disturbance rejection
3. Compare response with Single Loop mode when applying disturbances

## Interactive Features

- **Chart Tooltip**: Hold **ALT** over the chart to see all values at a specific time
- **Variable Selection**: Toggle variables on/off using color-matched buttons
- **Technical Hints**: Hold **ALT** while hovering over any control parameter (Kp, Ti, Td, etc.) to see its technical explanation
- **Direct Input**: Click sensors or valves in the SVG diagram to interact directly

## Simulation Controls

### Speed Control
- **Pause (0x)**: Freezes the simulation
- **Normal (1x)**: Standard speed
- **Quick (2x)** to **Ludicrous (20x)**: Faster speeds for long-term testing

### Disturbances
Test the control system's robustness:
- **Boiler Failure**: Gradual steam pressure drop from 3 BAR to 0 BAR over 30 seconds
- **Valve Wear (Deadband)**: Adds mechanical deadband (0-5%) where small valve commands are ignored
- **Pressure Noise**: Random pressure fluctuations (0-1 BAR) simulating other plant loads

### Reset
- **Reset Scene**: Resets physics and time, keeps your PID tuning parameters

## Control Panel

### PID Parameters

**Master PID (Temperature Control):**
- **Kp**: Proportional gain (0.1-10)
- **Ti (s)**: Integral time (0.1-1000s)
- **Td (s)**: Derivative time (0-100s)
- **Deadband (°C)**: Range around SP where controller freezes output
- **SP (°C)**: Temperature setpoint (60-85°C)

**Slave PID (Steam Control):**
- **Kp**: Proportional gain (0.1-20)
- **Ti (s)**: Integral time (0.1-500s)
- **Td (s)**: Derivative time (0-50s)

### Performance Score
- **IAE (Integral Absolute Error)**: Accumulated absolute error
- Scoring starts when temperature first touches setpoint
- Differences within ±1.0°C don't increase the score
- Lower score = better control performance

## License

MIT License - see [LICENSE](LICENSE) file.

## Author

Created by [ArthurkaX](https://github.com/ArthurkaX) for PLC engineers and automation specialists.