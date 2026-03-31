# PID Controller Formula and Architecture

## 1. PID Formula and Core Structure

At its core, the control algorithm operates on deviation (error). The complete continuous-time formula for the output value $u(t)$ is represented as:

$$u(t) = K_p \left[ e_P(t) + \frac{1}{T_i} \int_{0}^{t} e(t) dt + T_d \frac{d}{dt} e_D(t) \right]$$

Where:

- **$K_p$** — Proportional gain.
- **$T_i$** — Integral action time.
- **$T_d$** — Derivative action time.
- **$e(t)$** — The primary error or mismatch, calculated as: $Setpoint - ProcessValue$.

## 2. P/D Action Weighting Coefficients

These two parameters ($b$ for the Proportional action and $a$ for the Derivative action) adjust how the controller responds to a change in the setpoint ($Setpoint$). By doing so, they prevent sudden output surges or "bumps" (often called proportional or derivative "kick").

- **P-Action Weighting ($b$)**:
  Instead of using the standard error equation $e(t)$, the proportional part is evaluated as:
  $$e_P(t) = (b \cdot Setpoint) - ProcessValue$$
  - If **$b = 1.0$** (default), the controller instantly and fully reacts to a change in the setpoint in its proportional part.
  - If **$b = 0.0$**, the proportional term acts entirely based on changes in the process value, completely ignoring setpoint leaps, and thus leading to a much smoother response curve.

- **D-Action Weighting ($a$)**:
  Similarly, the derivative portion is governed by:
  $$e_D(t) = (a \cdot Setpoint) - ProcessValue$$
  - When **$a = 0.0$** (which is a standard practice for many processes), the derivative term only calculates the rate of change of the actual process value. This effectively eliminates massive spikes in the control output when the operator suddenly changes the setpoint.

## 3. Output Value Limits

This logic restricts the final control signal $u(t)$ to remain within defined physical or operational boundaries.

- **Principle of Operation**: You specify two values: `OutputUpperLimit` (default 100.0%) and `OutputLowerLimit` (default 0.0%).
- **Automatic Clamping**: The final calculated output is clamped between these two bounds before being sent to the actuator or the next controller in a cascade.
- **Mathematical Consequence**: This prevents the controller from requesting unreasonable values (e.g., trying to open a valve more than 100%) and is essential for implementing anti-windup logic for the integral term.
- **Indication**: Reaching either limit trips the respective state flags: `OutputLimit_H` (High limit hit) or `OutputLimit_L` (Low limit hit).

## 4. Discretization and the Derivative Filter

Because this controller operates digitally, calculating a pure mathematical derivative will dramatically amplify noise. Therefore, the derivative action employs a **Derivative delay coefficient ($c$)**.

This coefficient acts as a first-order low-pass filter (a **PT1-element** / lag filter) applied specifically to the D-part. The filter prevents the derivative calculation from amplifying high-frequency sensor noise, which would otherwise translate into erratic and aggressive jitter in the final control element (e.g., a control valve).

## 5. Cascade Control: Master and Slave PIDs

In a cascade control strategy, two PID controllers are linked together to achieve better stability and disturbance rejection. From a source code and internal algorithm perspective, **both the Master and Slave controllers are identical** (they use the exact same PID formula, weighting coefficients, and limits described above).

The difference lies entirely in **how they are connected and what they compute**:

### PID Master (Primary Controller)

- **Role**: Controls the slow, primary process variable (e.g., the final product temperature).
- **Process Value (PV)**: The main measurement that matters to the operator (Product Output Temperature).
- **Setpoint (SP)**: The target value defined by the operator or the overall system.
- **Output (CV)**: Instead of driving a physical valve, the Master controller's output is sent as the **dynamic Setpoint** to the Slave controller.

### PID Slave (Secondary Controller)

- **Role**: Controls a fast-responding, secondary process variable (e.g., intermediate fluid temperature or flow rate) to counteract disturbances before they can affect the primary process.
- **Process Value (PV)**: The secondary, fast-reacting measurement.
- **Setpoint (SP)**: Provided dynamically by the output of the PID Master.
- **Output (CV)**: This is the actual physical control signal that drives the final control element (e.g., the opening percentage of the steam or cooling valve).

Because both use the same identical controller code structure, features like Setpoint Limits in the Slave PID naturally act as a hard constraint on what the Master PID is allowed to request, adding inherent safety to the cascade loop.

## 6. Deadband Logic

To prevent excessive actuator wear (chattering) when the process is near the setpoint, a **Deadband** parameter is implemented.

- **Principle**: If $|SP - PV| < Deadband$, the controller effectively "freezes" its output.
- **Behavior**:
  - Proportional and Derivative terms are zeroed.
  - Integral accumulation stops (to avoid slow drift).
  - The output stays at the last reached integral value.
- **Use Case**: Essential for slow processes with measurement noise where 0.1% valve movements are meaningless but physically damaging in the long run.

## 7. Safety and Robustness

The simulator includes protection against common numerical stability issues found in real-time control:

- **NaN Protection**: If a user clears an input field or sends invalid data, the controller ignores the `NaN` value and maintains its previous working parameters.
- **Zero-Ti Protection**: If Integral Time ($T_i$) is set to a very low value (effectively 0), integral accumulation is disabled to prevent division-by-zero errors or infinite windup.
- **Anti-Windup**: The integral term is strictly clamped within $[-200, 200]$ to ensure the controller can recover quickly from saturation (e.g., when the heating power is physically insufficient to reach a very high SP).

---

## 8. Default PID Parameters

### PID Master (Primary Controller)
- **$K_p$**: 2.0
- **$T_i$**: 4.0 s
- **$T_d$**: 0.5 s
- **Deadband**: 0.0 °C
- **Setpoint Weight ($b$)**: 1.0
- **Derivative Weight ($a$)**: 0.0
- **Derivative Filter ($c$)**: 0.1
- **Setpoint**: 72 °C

### PID Slave (Secondary Controller)
- **$K_p$**: 5.0
- **$T_i$**: 2.5 s
- **$T_d$**: 0.1 s
- **Deadband**: 0.0 °C
- **Setpoint Weight ($b$)**: 1.0
- **Derivative Weight ($a$)**: 0.0
- **Derivative Filter ($c$)**: 0.1

### PID Single (Standalone Mode)
- **$K_p$**: 1.5
- **$T_i$**: 5.0 s
- **$T_d$**: 0.5 s
- **Deadband**: 0.0 °C
- **Setpoint Weight ($b$)**: 1.0
- **Derivative Weight ($a$)**: 0.0
- **Derivative Filter ($c$)**: 0.1
- **Setpoint**: 72 °C

### Tuning Guidelines

#### 1. Balanced (Universal)
Best option for operation with pressure noise enabled:
- **$K_p$**: 1.8
- **$T_i$**: 8.0 s
- **$T_d$**: 1.0 s
- **Deadband**: 0.05 °C
- **Why**: Moderate $K_p$ prevents oscillation with 5-second transport delay, while $T_d$ helps the controller anticipate temperature change rate.

#### 2. Conservative (Maximum Stability)
If you need a perfectly smooth response without overshoot:
- **$K_p$**: 1.2
- **$T_i$**: 12.0 s
- **$T_d$**: 0.0 s
- **Deadband**: 0.10 °C
- **Why**: Slower but very reliable. The system takes longer to reach setpoint (~40-50 s) but never overshoots.

#### 3. Aggressive (Fast Heating)
For maximum speed when reaching 72 °C (e.g., during startup):
- **$K_p$**: 2.5
- **$T_i$**: 6.0 s
- **$T_d$**: 2.0 s
- **Deadband**: 0.02 °C
