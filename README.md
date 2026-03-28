# PID Cascade Simulator - Pasteurizer

Browser-based interactive simulator demonstrating cascade PID control advantages over single-loop control for pasteurization processes.

**Live Demo:** https://arthurkax.github.io/pid-cascade/

![PID Cascade Simulator Demo](img/pid-cascade.gif)

## How to Use

Simply open the simulator in your browser - no installation required. The simulation starts automatically.

## Control Modes

### Manual Mode
1. Click **Manual** button
2. Use **Valve Position** slider (0-100%) or click valve in diagram
3. Observe temperature changes on HMI and charts

### Auto Mode - 1 PID (Single Loop)
1. Click **1 PID** button
2. Set **SP (Setpoint)** temperature (default: 72°C)
3. Adjust PID parameters to tune response
4. Watch the PID maintain setpoint by controlling the valve

### Auto Mode - Cascade PID
1. Click **Cascade PID** button
2. The system uses two nested PID loops:
   - **Outer Loop (Master)**: Controls milk temperature by setting steam pressure
   - **Inner Loop (Slave)**: Controls steam pressure for faster disturbance rejection
3. Compare response with Single Loop mode when applying disturbances

## Automated Test Sequence

Click **Run Test** to start a standardized evaluation of your PID tuning.

### Test Phases

1. **Warmup** (max 360s)
   - All temperatures reset to 20°C (room temperature)
   - Waits for PV to reach SP (Setpoint)
   - After first touch, waits 15s for stabilization
   - IAE scoring starts ONLY after PV first reaches SP
   - This tests startup transient and overshoot

2. **Cold Product (5°C)** (max 360s)
   - Inlet temperature drops to 5°C
   - Tests disturbance rejection capability
   - Waits for inlet to reach 5°C ±0.5°C
   - Then waits 15s with |PV-SP| < 1°C for stabilization

3. **Stabilization** (max 180s)
   - Maintains at 5°C inlet temperature
   - Tests steady-state performance
   - 15s stabilization with |PV-SP| < 1°C required

4. **Water (15°C)** (max 300s)
   - Inlet temperature rises to 15°C
   - Tests response to positive temperature step
   - Waits for inlet to reach 15°C ±0.5°C
   - Then waits 15s with |PV-SP| < 1°C for stabilization

5. **Boiler Failure** (max 90s)
   - Simulates gradual steam pressure loss
   - Boiler pressure drops to 0.5 BAR
   - Maintains for 15s at 0.5 BAR
   - Tests robustness to equipment failure

### Test Speed

The test runs at accelerated simulation speeds:
- **Fast (5x)**: Default speed for efficient testing
- **Turbo (10x)**: For quicker results
- **Ludicrous (20x)**: For rapid iteration

You can adjust speed during test using the speed selector.

### Scoring

- **IAE (Integral Absolute Error)**: Accumulated absolute error
- Scoring starts ONLY after temperature first touches setpoint during warmup
- Errors within ±1.0°C don't increase score (deadband)
- Lower score = better control performance
- Score reflects: startup transient, overshoot, disturbance rejection, steady-state error

### Leaderboard

After completing the test:
1. **Score Modal** shows your final IAE score, mode (Cascade/Single), and duration
2. Enter your name (max 20 characters)
3. Click **Save Score** to submit to Firebase leaderboard
4. View leaderboard to compare your tuning with others
5. Leaderboard shows: rank, name, score, mode, and date

## Interactive Features

- **Chart Tooltip**: Hold **ALT** over chart to see all values at a specific time
- **Variable Selection**: Toggle variables on/off using color-matched buttons
- **Technical Hints**: Hold **ALT** while hovering over any control parameter (Kp, Ti, Td, etc.) to see its technical explanation
- **Direct Input**: Click sensors or valves in SVG diagram to interact directly

## Simulation Controls

### Speed Control
- **Pause (0x)**: Freezes simulation
- **Normal (1x)**: Standard speed
- **Quick (2x)** to **Ludicrous (20x)**: Faster speeds for long-term testing

### Disturbances
Test control system's robustness:
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

## License

MIT License - see [LICENSE](LICENSE) file.

## Author

Created by [ArthurkaX](https://github.com/ArthurkaX) for PLC engineers and automation specialists.
