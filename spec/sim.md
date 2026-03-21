# Simulation Model and Disturbances

## 1. Physics Engine Architecture

The physics model is implemented as a set of differential equations and transport delays, running at **100 Hz (10ms steps)**. It simulates the thermal dynamics of a pasteurization unit with two fluid circuits (Milk and Water).

### Heat Transfer Formula
The core heat transfer between water ($T_w$) and milk ($T_m$) is calculated as:
$$Q = K \cdot (T_w - T_m) \cdot dt$$

### Dynamic Lag (PT1)
Each stage (Heating, Regeneration, Return) uses a first-order lag (PT1) to simulate thermal mass:
$$T_{new} = T_{old} + \frac{dt}{\tau} \cdot (T_{target} - T_{old})$$
Where $\tau$ is the time constant of the respective heating section.

## 2. Process Disturbances

The simulator provides several realistic disturbances to test PID robustness:

### Boiler Failure (Gradual)
*   **Trigger**: Toggle button.
*   **Effect**: Pressure gradually ramps down to **0 BAR** over approximately 30 seconds.
*   **Physics**: As pressure drops, the steam temperature used for calculation decreases (from 130°C to 100°C) and the effective energy transfer is scaled by the remaining pressure.
*   **Significance**: Simulates a critical utility failure. Tests the controller's behavior during a total loss of power and its ability to recover once steam is restored.

### Pressure Noise (Stochastic)
*   **Parameter**: $\pm$ BAR (0.0 to 1.0).
*   **Logic**: **Wandering Random Walk**. Every 1-3 seconds, a new target pressure offset is chosen. The pressure then smoothly "wanders" towards this target.
*   **Impact**: Creates continuous, unpredictable variations in heating capability, forcing the controller to constantly adjust the valve.

### Valve Wear (Mechanical Deadband)
*   **Parameter**: Percentage (0% to 5%).
*   **Logic**: **Mechanical Stiction/Hysteresis**. The valve ignores any change in the PID request that is smaller than the wear threshold relative to its current position. 
*   **Result**: Causes sustained oscillations (limit cycles) if the PID is tuned too aggressively or if the deadband is large, as the regulator cannot find a precise stable point.

## 3. Performance Scoring (IAE)

The **IAE (Integral Absolute Error)** value represents the accumulated error over time:
$$IAE = \int |SP - PV| dt$$

### Startup Guard logic
To ensure fair performance measurement, the IAE score includes specialized filters:
*   **Trigger**: After a "Reset Scene" command.
*   **Inhibition**: The core calculation is disabled during the initial startup phase.
*   **Activation**: Accumulation only starts when the product temperature ($PV$) **first touches** the setpoint ($SP$). 
*   **Deadband**: Any error less than or equal to **1.0°C** is considered negligible and is not added to the total score. Only deviations larger than 1.0°C contribute to the performance penalty.
*   **Manual Reset**: The operator can reset the IAE score at any time via the HMI without affecting the simulation.
