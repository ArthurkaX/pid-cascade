// ==========================================
// WORKER.JS - PLC CONTROLLER
// ==========================================

// ==========================================
// DATA BLOCKS (Глобальные объекты состояния)
// ==========================================

const InputDB = {
    // Manual control
    cmd_ValveManualPercent: 0,
    
    // Configuration
    cfg_ControlMode: 'manual',      // 'manual' | 'single' | 'cascade'
    cfg_SpeedMultiplier: 1,         // Initialized to 1x (Running)
    
    // Disturbances (bitmask + analog)
    cmd_DisturbanceFlags: 0,        // 0x01: pressure drop
                                     // 0x02: valve wear
                                     // 0x04: dry steam
                                     // 0x08: inlet variation
                                     // 0x10: flow noise
    dist_ValveWear: 0,              // 0-100%
    dist_PressureNoise: 0,          // BAR (0..1)
    dist_InletTempSP: 20,           // Target inlet temperature (TT202 target)
    dist_InletTempRate: 0.065,      // Change rate (°C/s) - accelerated 30%
    
    // PID Master params
    master_Kp: 2.0,
    master_Ti: 4.0,
    master_Td: 0.5,
    master_c: 0.1,
    master_b: 1.0,
    master_a: 0.0,
    master_sp_h: 85.0,
    master_sp_l: 0.0,
    master_out_h: 100.0,
    master_out_l: 0.0,
    master_SP: 72,
    
    // PID Slave params
    slave_Kp: 5.0,
    slave_Ti: 2.5,
    slave_Td: 0.1,
    slave_c: 0.1,
    slave_b: 1.0,
    slave_a: 0.0,
    slave_sp_h: 100.0,
    slave_sp_l: 0.0,
    slave_out_h: 100.0,
    slave_out_l: 0.0,
    slave_override_sp: false,
    slave_manual_SP: 2.0,
    
    // PID Single params (Different set from Cascade Master)
    single_Kp: 1.5,
    single_Ti: 5.0,
    single_Td: 0.5,
    single_c: 0.1,
    single_b: 1.0,
    single_a: 0.0,
    single_sp_h: 85.0,
    single_sp_l: 0.0,
    single_out_h: 100.0,
    single_out_l: 0.0,
    single_Deadband: 0.0,
    single_SP: 72,

    master_Deadband: 0.0,
    slave_Deadband: 0.0
};

const OutputDB = {
    actuator_SteamValvePercent: 0,
    master_Output: 0,
    slave_Output: 0
};

const HmiDB = {
    // Temperatures
    vis_TMilkOutlet: 20,             // Milk outlet temperature (°C)
    vis_TMilkInlet: 10,              // Milk inlet temperature (°C)
    vis_TWaterAfterSteam: 55,        // Hot water temperature (°C)
    
    // Process variables
    vis_SteamPressure: 3.0,         // Steam pressure (bar)
    vis_FlowRate: 5.0,               // Product flow rate (t/h)
    
    // scoring
    score_IAE: 0,                    // Integral Absolute Error
    vis_IAEActive: false,            // IAE accumulation active (after first PV >= SP)
    vis_ProductDelta: 0,             // Current deviation (PV - SP)
    
    // Time
    vis_SimulationTime: 0            // Simulation clock
};

// ==========================================
// СВЯЗЬ С HMI (Сетевой интерфейс / Шина)
// ==========================================

self.onmessage = function(event) {
    const msg = event.data;
    
    if (msg.type === 'WRITE_INPUTS') {
        const payload = msg.payload;
        
        // Check if control mode changed for bumpless transfer
        if (payload.cfg_ControlMode !== undefined) {
            const oldMode = InputDB.cfg_ControlMode;
            const newMode = payload.cfg_ControlMode;
            
            if (newMode === 'manual' && oldMode !== 'manual') {
                // Bumpless transfer to manual
                const currentVal = OutputDB.actuator_SteamValvePercent;
                InputDB.cmd_ValveManualPercent = currentVal;
                pidMaster.setManualOutput(currentVal);
                pidSlave.setManualOutput(currentVal);
                pidSingle.setManualOutput(currentVal);
            } else if (newMode !== 'manual' && oldMode === 'manual') {
                // Bumpless transfer to auto
                pidMaster.setMode('auto');
                pidSlave.setMode('auto');
                pidSingle.setMode('auto');
            }
        }

        // Check if PID parameters need updating
        if (payload.master_Kp !== undefined || 
            payload.master_Ti !== undefined || 
            payload.master_Td !== undefined ||
            payload.slave_Kp !== undefined ||
            payload.slave_Ti !== undefined ||
            payload.slave_Td !== undefined) {
            Object.assign(InputDB, payload);
            updatePIDParams();
        } else {
            Object.assign(InputDB, payload);
        }
    } else if (msg.type === 'RESET_SCENE') {
        if (typeof resetPhysics === 'function') {
            resetPhysics();
        }
        
        // Reset PID controllers but KEEP their parameters
        pidMaster.reset();
        pidSlave.reset();
        pidSingle.reset();
        
        // Reset outputs to safe states
        OutputDB.actuator_SteamValvePercent = 0;
        OutputDB.master_Output = 0;
        OutputDB.slave_Output = 0;
        
        // Force manual mode on reset to prevent sudden spikes
        InputDB.cfg_ControlMode = 'manual';
        InputDB.cmd_ValveManualPercent = 0;
        
        // Let the main thread know we reset the control mode
        self.postMessage({
            type: 'SCENE_RESET_COMPLETE',
            payload: { mode: 'manual' }
        });
    } else if (msg.type === 'RESET_IAE') {
        HmiDB.score_IAE = 0;
        HmiDB.vis_IAEActive = false;
    }
};

// ==========================================
// ЗАГРУЗКА МОДУЛЯ ФИЗИКИ
// ==========================================

importScripts('process.js');

// ==========================================
// PID CONTROLLER CLASS (Siemens PID Compact)
// ==========================================

class PIDController {
    constructor(params) {
        this.Kp = params.Kp || 1.0;
        this.Ti = params.Ti || 10.0;
        this.Td = params.Td || 0.0;
        this.c = params.c !== undefined ? params.c : 0.1;
        this.b = params.b !== undefined ? params.b : 1.0;
        this.a = params.a !== undefined ? params.a : 0.0;
        
        // Limits
        this.sp_h = params.sp_h !== undefined ? params.sp_h : 1000.0;
        this.sp_l = params.sp_l !== undefined ? params.sp_l : -1000.0;
        this.outputMax = params.out_h !== undefined ? params.out_h : 100.0;
        this.outputMin = params.out_l !== undefined ? params.out_l : 0.0;
        this.integral = 0.0;
        this.prevError = 0.0;
        this.prevSP = 0.0;
        this.prevPV = 0.0;
        this.derivativeFilter = 0.0;
        
        // Mode
        this.mode = 'auto';
        this.manualOutput = 0.0;
        
        // Anti-windup boundaries (linked to output limits)
        this.integralMin = this.outputMin;
        this.integralMax = this.outputMax;

        // Deadband
        this.deadband = params.Deadband || 0.0;
    }
    
    compute(setpoint, processVariable, dt) {
        if (this.mode === 'manual') {
            return this.manualOutput;
        }
        
        // Setpoint limits:
        let calcSP = Math.max(this.sp_l, Math.min(this.sp_h, setpoint));

        // Error for integral (full error)
        const error = calcSP - processVariable;
        
        // Proportional action with setpoint weighting
        const P_term = this.Kp * (this.b * calcSP - processVariable);
        
        // Derivative action calculation (needed for bumpless transfer logic)
        const dPV = processVariable - this.prevPV;
        const dSP = calcSP - this.prevSP;
        const derivative = -dPV + this.a * dSP;
        
        // First-order low-pass filter for derivative
        const alpha = (this.Td * this.c > 0) ? dt / (this.Td * this.c + dt) : 1.0;
        this.derivativeFilter = alpha * derivative + (1 - alpha) * this.derivativeFilter;
        const D_term = this.Kp * this.Td * this.derivativeFilter;

        // Anti-windup logic (Conditional Integration)
        if (this.Ti > 0.001) {
            // Check if output was already saturated in the previous cycle
            const saturatedHigh = this.prevOutput >= this.outputMax && error > 0;
            const saturatedLow = this.prevOutput <= this.outputMin && error < 0;
            
            if (!saturatedHigh && !saturatedLow) {
                // Siemens PID Compact: Integral gain is Kp/Ti
                this.integral += (this.Kp * error * dt) / this.Ti;
            }
        }
        
        // Clamp integral to output limits (Standard anti-windup)
        this.integral = Math.max(this.outputMin, Math.min(this.outputMax, this.integral));
        
        const I_term = this.integral;
        
        // Total output
        let output = P_term + I_term + D_term;
        
        // Apply deadband: if error is within deadband, freeze others and use I-term
        if (Math.abs(error) < this.deadband) {
            output = this.integral; 
        }

        // Apply final output limits (High/Low)
        output = Math.max(this.outputMin, Math.min(this.outputMax, output));
        
        // Store previous values
        this.prevError = error;
        this.prevSP = calcSP;
        this.prevPV = processVariable;
        this.prevOutput = output;
        
        return output;
    }
    
    setMode(mode) {
        if (mode !== this.mode) {
            this.mode = mode;
            if (mode === 'manual') {
                // Store current output when switching to manual
                this.manualOutput = this.getOutput();
            } else {
                // Bumpless transfer: reset integral to maintain current output
                // I = Output - P - D
                const P_term = this.Kp * (this.b * this.prevSP - this.prevPV);
                const D_term = this.Kp * this.Td * this.derivativeFilter;
                this.integral = this.manualOutput - P_term - D_term;
                // Ensure initial integral is within limits
                this.integral = Math.max(this.outputMin, Math.min(this.outputMax, this.integral));
            }
        }
    }
    
    setManualOutput(value) {
        this.manualOutput = Math.max(this.outputMin, Math.min(this.outputMax, value));
        if (this.mode === 'auto') {
            this.setMode('manual');
        }
    }
    
    getOutput() {
        // Return last computed output (or manual output)
        if (this.mode === 'manual') return this.manualOutput;
        
        const P_term = this.Kp * (this.b * this.prevSP - this.prevPV);
        const D_term = this.Kp * this.Td * this.derivativeFilter;
        return P_term + this.integral + D_term;
    }
    
    reset() {
        this.integral = 0.0;
        this.prevError = 0.0;
        this.prevSP = 0.0;
        this.prevPV = 0.0;
        this.prevOutput = 0.0;
        this.derivativeFilter = 0.0;
        this.manualOutput = 0.0;
    }
    
    updateParams(params) {
        if (params.Kp !== undefined && !isNaN(params.Kp)) this.Kp = params.Kp;
        if (params.Ti !== undefined && !isNaN(params.Ti)) this.Ti = params.Ti;
        if (params.Td !== undefined && !isNaN(params.Td)) this.Td = params.Td;
        if (params.c !== undefined && !isNaN(params.c)) this.c = params.c;
        if (params.b !== undefined && !isNaN(params.b)) this.b = params.b;
        if (params.a !== undefined && !isNaN(params.a)) this.a = params.a;
        if (params.sp_h !== undefined && !isNaN(params.sp_h)) this.sp_h = params.sp_h;
        if (params.sp_l !== undefined && !isNaN(params.sp_l)) this.sp_l = params.sp_l;
        if (params.out_h !== undefined && !isNaN(params.out_h)) {
            this.outputMax = params.out_h;
            this.integralMax = params.out_h;
        }
        if (params.out_l !== undefined && !isNaN(params.out_l)) {
            this.outputMin = params.out_l;
            this.integralMin = params.out_l;
        }
        if (params.Deadband !== undefined && !isNaN(params.Deadband)) this.deadband = params.Deadband;
    }
}

// ==========================================
// INITIALIZE PID CONTROLLERS
// ==========================================

const pidMaster = new PIDController({
    Kp: InputDB.master_Kp,
    Ti: InputDB.master_Ti,
    Td: InputDB.master_Td,
    c: InputDB.master_c,
    b: InputDB.master_b,
    a: InputDB.master_a,
    sp_h: InputDB.master_sp_h,
    sp_l: InputDB.master_sp_l,
    out_h: InputDB.master_out_h,
    out_l: InputDB.master_out_l,
    Deadband: InputDB.master_Deadband
});

const pidSlave = new PIDController({
    Kp: InputDB.slave_Kp,
    Ti: InputDB.slave_Ti,
    Td: InputDB.slave_Td,
    c: InputDB.slave_c,
    b: InputDB.slave_b,
    a: InputDB.slave_a,
    sp_h: InputDB.slave_sp_h,
    sp_l: InputDB.slave_sp_l,
    out_h: InputDB.slave_out_h,
    out_l: InputDB.slave_out_l,
    Deadband: InputDB.slave_Deadband
});

const pidSingle = new PIDController({
    Kp: InputDB.single_Kp,
    Ti: InputDB.single_Ti,
    Td: InputDB.single_Td,
    c: InputDB.single_c,
    b: InputDB.single_b,
    a: InputDB.single_a,
    sp_h: InputDB.single_sp_h,
    sp_l: InputDB.single_sp_l,
    out_h: InputDB.single_out_h,
    out_l: InputDB.single_out_l,
    Deadband: InputDB.single_Deadband
});

// ==========================================
// PLC SCAN CYCLE (Цикл контроллера)
// ==========================================

const SCAN_CYCLE_MS = 10;
let tickCounter = 0;

function plcCycle() {
    // Physics and PID execution:
    // We use Math.max(0, ...) but basically it runs if speed >= 0.
    // To satisfy 'always', we ensure the cycle continues.
    
    // Physics step: always 10ms real-time cycle
    if (typeof calculatePhysicsStep === 'function') {
        calculatePhysicsStep();
    }
    
    // PID execution: every 40ms (every 4th tick)
    if (tickCounter % 4 === 0) {
        executePID();
        
        // Send state to HMI at the same frequency as PID (25Hz / 40ms)
        // This prevents the UI from choking on 100fps updates with large datasets
        const hmiUpdate = { ...HmiDB };
        if (typeof hmiUpdate.vis_IAEActive === 'undefined') {
            hmiUpdate.vis_IAEActive = false;
        }
        self.postMessage({
            type: 'PLC_STATE_UPDATE',
            payload: {
                outputs: { ...OutputDB },
                hmi: hmiUpdate,
                inputs: { ...InputDB }
            }
        });
    }
    
    tickCounter++;
    
    setTimeout(plcCycle, SCAN_CYCLE_MS);
}

// ==========================================
// PID EXECUTION
// ==========================================

function executePID() {
    const dt = 0.04; // 40ms
    
    const mode = InputDB.cfg_ControlMode;
    
    if (mode === 'manual') {
        pidMaster.setMode('manual');
        pidSlave.setMode('manual');
        pidSingle.setMode('manual');
        
        OutputDB.actuator_SteamValvePercent = InputDB.cmd_ValveManualPercent;
    } else if (mode === 'single') {
        pidSingle.setMode('auto');
        const singleOut = pidSingle.compute(
            InputDB.single_SP || InputDB.master_SP, 
            HmiDB.vis_TMilkOutlet,
            dt
        );
        OutputDB.actuator_SteamValvePercent = singleOut;
        OutputDB.master_Output = singleOut; // In single mode, consider it as the primary output
        OutputDB.slave_Output = 0;
    } else if (mode === 'cascade') {
        pidMaster.setMode('auto');
        pidSlave.setMode('auto');
        
        const masterOut = pidMaster.compute(
            InputDB.master_SP,
            HmiDB.vis_TMilkOutlet,
            dt
        );
        
        // In Cascade, Master output is the Slave's Setpoint
        let slaveSP = masterOut; 
        
        // Manual override for debugging
        if (InputDB.slave_override_sp) {
            slaveSP = InputDB.slave_manual_SP;
        }

        const slaveOut = pidSlave.compute(slaveSP, HmiDB.vis_TWaterAfterSteam, dt);
        
        OutputDB.actuator_SteamValvePercent = slaveOut;
        OutputDB.master_Output = masterOut;
        OutputDB.slave_Output = slaveOut;
    }

    // Calculate Product Delta for HMI (Current PV - Required SP)
    let activeSP = InputDB.master_SP;
    if (mode === 'single') activeSP = InputDB.single_SP;
    HmiDB.vis_ProductDelta = HmiDB.vis_TMilkOutlet - activeSP;
}

// ==========================================
// UPDATE PID PARAMETERS
// ==========================================

function updatePIDParams() {
    pidMaster.updateParams({
        Kp: InputDB.master_Kp,
        Ti: InputDB.master_Ti,
        Td: InputDB.master_Td,
        c: InputDB.master_c,
        b: InputDB.master_b,
        a: InputDB.master_a,
        sp_h: InputDB.master_sp_h,
        sp_l: InputDB.master_sp_l,
        out_h: InputDB.master_out_h,
        out_l: InputDB.master_out_l,
        Deadband: InputDB.master_Deadband
    });
    
    pidSlave.updateParams({
        Kp: InputDB.slave_Kp,
        Ti: InputDB.slave_Ti,
        Td: InputDB.slave_Td,
        c: InputDB.slave_c,
        b: InputDB.slave_b,
        a: InputDB.slave_a,
        sp_h: InputDB.slave_sp_h,
        sp_l: InputDB.slave_sp_l,
        out_h: InputDB.slave_out_h,
        out_l: InputDB.slave_out_l,
        Deadband: InputDB.slave_Deadband
    });
    
    pidSingle.updateParams({
        Kp: InputDB.single_Kp,
        Ti: InputDB.single_Ti,
        Td: InputDB.single_Td,
        c: InputDB.single_c,
        b: InputDB.single_b,
        a: InputDB.single_a,
        sp_h: InputDB.single_sp_h,
        sp_l: InputDB.single_sp_l,
        out_h: InputDB.single_out_h,
        out_l: InputDB.single_out_l,
        Deadband: InputDB.single_Deadband
    });
}

// Start PLC
console.log("PLC Worker Started");
plcCycle();
