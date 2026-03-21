// ==========================================
// PROCESS.JS - PHYSICS MODEL (Improved)
// ==========================================

// ==========================================
// PROCESS STATE VARIABLES
// ==========================================

let tMilkInlet = 20;
let tMilkInletCurrent = 20; // Current actual inlet temp (ramped)
let tMilkAfterRegen = 20;
let tMilkAfterHeating = 20;
let tMilkOutlet = 20;
let tWaterAfterSteam = 20; // TT101
let tWaterReturn = 20;      // Temperature of water after Main HE
let currentValvePosition = 0;
let steamNoiseOffset = 0;    // Current random pressure fluctuation
let steamNoiseTarget = 0;    // Target fluctuation (wanders)
let steamNoiseTimer = 0;     // Timer to pick new target
let iaeActive = false;       // Only start counting IAE after PV first touches SP
let boilerFailureEffect = 0; // Current boiler failure pressure drop (0 to 3.0 BAR)

// Simulation time for gradual disturbances
let simTime = 0;

// ==========================================
// HEAT EXCHANGER PARAMETERS
// ==========================================

const HE_PARAMS = {
    K_regen: 0.75,
    tau_regen: 8,
    L_regen: 2,
    K_heating: 0.65,
    tau_heating: 10,
    L_heating: 3,
    L_holding: 5,
    K_water: 0.85,
    tau_water: 5,
    L_water: 2,
    Valve_Stroking: 3,
    Ambient_Loss: 0.005, // Cooling rate to 20C
    Env_Temp: 20
};

// ==========================================
// TRANSPORT DELAY BUFFERS (Ring buffers)
// ==========================================

const delayBuffers = {
    milkRegen: [],
    milkOutlet: []
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function firstOrderLag(input, output, K, tau, dt) {
    // G(s) = K / (tau*s + 1)
    return output + (K * input - output) * dt / tau;
}

function applyTransportDelay(input, delaySeconds, bufferName) {
    const buffer = delayBuffers[bufferName];
    const samples = Math.ceil(delaySeconds * 100); // 10ms cycle
    
    buffer.push(input);
    
    if (buffer.length > samples) {
        return buffer.shift();
    }
    
    return buffer[0];
}

// ==========================================
// DISTURBANCES
// ==========================================

function applyPhysicsDisturbances(dt) {
    const flags = InputDB.cmd_DisturbanceFlags || 0;
    simTime += dt;

    // 1. Inlet temp (TT202) Ramping logic
    const targetInlet = (InputDB.dist_InletTempSP !== undefined) ? InputDB.dist_InletTempSP : 10;
    const rate = (InputDB.dist_InletTempRate !== undefined) ? InputDB.dist_InletTempRate : 0.5;
    
    const diffInlet = targetInlet - tMilkInletCurrent;
    if (Math.abs(diffInlet) > 0.01) {
        tMilkInletCurrent += clamp(diffInlet, -rate * dt, rate * dt);
    }
    
    // Add small noise to inlet
    const noise = (Math.random() - 0.5) * 0.1;
    tMilkInlet = tMilkInletCurrent + noise;

    // 2. Boiler Failure (Gradual reduction to 2 BAR)
    if (flags & 0x01) {
        // Slow failure: takes about 20 seconds to drop from 3 BAR to 2 BAR
        boilerFailureEffect = Math.min(2.0, boilerFailureEffect + dt * 0.1);
    } else {
        // Recovery: slightly faster recovery (10 seconds)
        boilerFailureEffect = Math.max(0, boilerFailureEffect - dt * 0.3);
    }

    // 3. Steam Pressure Variation (Random Walk / Wandering noise)
    const noiseMagnitude = (InputDB.dist_PressureNoise !== undefined) ? InputDB.dist_PressureNoise : 0;
    
    // Pick new target every ~2 seconds
    steamNoiseTimer -= dt;
    if (steamNoiseTimer <= 0) {
        steamNoiseTarget = (Math.random() - 0.5) * 2 * noiseMagnitude;
        steamNoiseTimer = 1.0 + Math.random() * 2.0;
    }
    
    // Smoothly wander towards target (moderately fast)
    const wanderRate = 0.5; // BAR per second
    const diffNoise = steamNoiseTarget - steamNoiseOffset;
    steamNoiseOffset += clamp(diffNoise, -wanderRate * dt, wanderRate * dt);
    
    // 4. Valve wear
    let eff_Valve_Stroking = HE_PARAMS.Valve_Stroking;
    if (flags & 0x02) eff_Valve_Stroking *= 2;

    const eff_K_water = HE_PARAMS.K_water;

    return { eff_K_water, eff_Valve_Stroking };
}

// ==========================================
// MAIN PHYSICS CALCULATION
// ==========================================

function calculatePhysicsStep() {
    const dt = 0.01; // 10ms
    const speed = InputDB.cfg_SpeedMultiplier;
    const steps = (speed !== undefined) ? speed : 1;

    for (let i = 0; i < steps; i++) {
        step(dt);
    }
}

function step(dt) {
    // 0. Update Pressure first (so following steps use latest value)
    // Base pressure + valve-dependent dynamic drop + random noise - boiler failure
    HmiDB.vis_SteamPressure = Math.max(0, 3.0 - boilerFailureEffect + steamNoiseOffset - (currentValvePosition/100)*0.2 + (Math.random()-0.5)*0.02);

    // 1. Apply disturbances
    const { eff_K_water, eff_Valve_Stroking } = applyPhysicsDisturbances(dt);

    // 2. Valve dynamics (stroking rate limit)
    const valveTarget = OutputDB.actuator_SteamValvePercent;
    const valveRate = 100 / eff_Valve_Stroking;
    
    let deadband = (InputDB.cmd_DisturbanceFlags & 0x02) ? (InputDB.dist_ValveWear || 0) : 0;
    const diffValve = valveTarget - currentValvePosition;
    if (Math.abs(diffValve) > deadband) {
        currentValvePosition += clamp(diffValve, -valveRate * dt, valveRate * dt);
    }

    // 3. Ambient Cooling (Heat loss to 20C)
    const envCooling = (temp) => (temp - HE_PARAMS.Env_Temp) * HE_PARAMS.Ambient_Loss * dt;
    tWaterAfterSteam -= envCooling(tWaterAfterSteam);
    tWaterReturn -= envCooling(tWaterReturn);
    tMilkAfterHeating -= envCooling(tMilkAfterHeating) * 0.5; // Product is usually better insulated

    // 4. Steam-Water Heat Exchanger (Steam -> Water)
    // Steam temperature depends on pressure (approx: 0 BAR = 100C, 3 BAR = 130C)
    const tSteamActual = 100 + HmiDB.vis_SteamPressure * 10;
    
    // Gain depends on temperature diff AND available steam mass (pressure)
    const pressureScale = Math.max(0, HmiDB.vis_SteamPressure / 3.0);
    const steamEnergy = (currentValvePosition / 100) * (tSteamActual - tWaterAfterSteam) * eff_K_water * pressureScale;
    
    tWaterAfterSteam = firstOrderLag(
        tWaterReturn + steamEnergy * 4.0, 
        tWaterAfterSteam,
        1.0, 
        HE_PARAMS.tau_water,
        dt
    );

    // 5. Regeneration Section (Heat exchange between product in and product out)
    // Product Out heats up Product In (or vice versa)
    const regenDelta = (tMilkOutlet - tMilkInletCurrent) * HE_PARAMS.K_regen;
    tMilkAfterRegen = firstOrderLag(tMilkInletCurrent + regenDelta, tMilkAfterRegen, 1.0, HE_PARAMS.tau_regen, dt);
    
    // 6. Main Heat Exchanger (Water <-> Milk exchange)
    // Milk is heated (or cooled) by Water (TT101).
    const heatingDelta = (tWaterAfterSteam - tMilkAfterRegen) * HE_PARAMS.K_heating;
    const targetHeating = tMilkAfterRegen + heatingDelta;
    
    tMilkAfterHeating = firstOrderLag(targetHeating, tMilkAfterHeating, 1.0, HE_PARAMS.tau_heating, dt);
    
    // Water temperature responds to heat exchange with product.
    // If product (25C) is hotter than water (20C), water MUST heat up.
    // Given 5000L/h product vs water loop, the thermal mass of product is dominant.
    const waterCoolingTarget = tWaterAfterSteam - heatingDelta * 0.8;
    tWaterReturn = firstOrderLag(waterCoolingTarget, tWaterReturn, 1.0, HE_PARAMS.tau_water, dt);

    // 7. Holding tube (transport delay)
    tMilkOutlet = applyTransportDelay(tMilkAfterHeating, HE_PARAMS.L_holding, 'milkOutlet');

    // 8. Update HMI variables
    HmiDB.vis_TMilkOutlet = tMilkOutlet + (Math.random() - 0.5) * 0.05;
    HmiDB.vis_TMilkInlet = tMilkInlet;
    HmiDB.vis_TWaterAfterSteam = tWaterAfterSteam + (Math.random() - 0.5) * 0.1;
    
    // Score logic moves here (pressure update moved to top of step)
    
    if (InputDB.cfg_ControlMode === 'single' || InputDB.cfg_ControlMode === 'cascade') {
        const activeSP = (InputDB.cfg_ControlMode === 'single') ? (InputDB.single_SP || 72) : (InputDB.master_SP || 72);
        const currentPV = HmiDB.vis_TMilkOutlet || 0;
        
        // Logic: Start IAE accumulation only after PV first reaches the Setpoint
        if (!iaeActive) {
            if (currentPV >= activeSP) {
                iaeActive = true;
            }
        }
        
        if (iaeActive) {
            const absError = Math.abs(activeSP - currentPV);
            if (absError > 1.0) {
                HmiDB.score_IAE += absError * dt;
            }
        }
    }

    HmiDB.vis_SimulationTime = simTime;
}

// ==========================================
// RESET FUNCTION
// ==========================================

function resetPhysics() {
    tMilkInlet = 20;
    tMilkInletCurrent = 20;
    tMilkAfterRegen = 20;
    tMilkAfterHeating = 20;
    tMilkOutlet = 20;
    tWaterAfterSteam = 20;
    tWaterReturn = 20;
    currentValvePosition = 0;
    steamNoiseOffset = 0;
    steamNoiseTarget = 0;
    steamNoiseTimer = 0;
    boilerFailureEffect = 0;
    simTime = 0;
    
    // Clear delay buffers
    delayBuffers.milkRegen = [];
    delayBuffers.milkOutlet = [];
    
    // Reset IAE
    HmiDB.score_IAE = 0;
    iaeActive = false;
}
