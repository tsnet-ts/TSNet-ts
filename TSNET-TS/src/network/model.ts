/**
 * The tsnet.network.geometry read in the geometry defined by EPANet
 * .inp file, and assign additional parameters needed in transient
 * simulation later in tsnet.
 */

import * as np from 'numpy-ts';
import { WaterNetworkModel, LinkStatus } from '../epanet-bridge.ts';
import type { Pipe, Link } from '../epanet-bridge.ts';
import {
    discretization, max_time_step,
    discretization_N, max_time_step_N
} from './discretize.ts';
import {
    valveclosing,
    valveopening,
    pumpclosing,
    pumpopening,
    burstsetting,
    demandpulse
} from './control.ts';
import { detect_cusum } from '../postprocessing/detect-cusum.ts';

export class TransientModel extends WaterNetworkModel {
    /** Transient model class.
     * Parameters
     * -------------------
     * inp_file_name: string
     *     Directory and filename of EPANET inp file to load into the
     *     WaterNetworkModel object.
     */

    simulation_timestamps: number[] = [];
    time_step: number = 0.;
    simulation_period: number = 0.;
    initial_velocity: number[] = [];
    initial_head: number[] = [];
    wavespeed_adj: number = 0;

    constructor() {
        super();
    }

    static override async create(inp_file: string): Promise<TransientModel> {
        const tm = new TransientModel();
        tm._inp_file = inp_file;
        await tm._initialize(inp_file);
        tm._postInit();
        return tm;
    }

    static override async createFromContent(inpContent: string): Promise<TransientModel> {
        const tm = new TransientModel();
        tm._inp_file = '<from-content>';
        await tm._initializeFromContent(inpContent);
        tm._postInit();
        return tm;
    }

    private _postInit(): void {
        // assign ID to each links, start from 1.
        let i = 1;
        for (const [, link] of this.links()) {
            link.id = i;
            i++;
        }
        for (const [, valve] of this.valves()) {
            valve.valve_coeff = null;
        }
        // assign ID to each nodes, start from 1.
        i = 1;
        for (const [, node] of this.nodes()) {
            node.id = i;
            node._leak_status = false;
            node.burst_status = false;
            node.blockage_status = false;
            node.pulse_status = false;
            node.emitter_coeff = 0.;
            node.block_per = 0.;
            node.transient_node_type = node.node_type;
            i++;
        }

        // calculate the slope and area for each pipe
        for (const [, pipe] of this.pipes()) {
            pipe.area = pipe.diameter ** 2. * Math.PI / 4.;
            let theta: number;
            try {
                theta = Math.sin(Math.atan(pipe.end_node.elevation -
                    pipe.start_node.elevation) / pipe.length);
            } catch {
                theta = 0.0;
            }
            pipe.theta = theta;
        }

        // set operating default value as False
        for (const [, link] of this.links()) {
            link.operating = false;
        }
    }

    set_wavespeed(wavespeed: number | number[] = 1200, pipes: string[] | null = null): void {
        /**
         * Set wave speed for pipes in the network
         *
         * Parameters
         * ----------
         * wavespeed : float or int or list, optional
         *     If given as float or int, set the value as wavespeed
         *     for all pipe; If given as list set the corresponding
         *     value to each pipe, by default 1200.
         * pipes : str or list, optional
         *     The list of pipe to define wavespeed,
         *     by default all pipe in the network.
         */
        let generator = 0;
        let pipesList: Iterable<[string, Pipe]> | Link[];
        let num_pipes: number;

        if (pipes == null) {
            generator = 1;
            pipesList = this.pipes();
            num_pipes = this.num_pipes;
        } else {
            pipesList = pipes.map(pipe => this.get_link(pipe));
            num_pipes = pipesList.length;
        }

        let wavespeedArr: number[];
        if (typeof wavespeed === 'number') {
            // if wavespeed is a float, assign it to all pipes
            wavespeedArr = Array(num_pipes).fill(wavespeed);
        } else if (Array.isArray(wavespeed)) {
            // if wavespeed is a list, assign each elements
            // to the respective pipes.
            if (wavespeed.length !== num_pipes) {
                throw new Error('The length of the wavespeed \
                input does not equal number of pipes. ');
            }
            wavespeedArr = wavespeed;
        } else {
            throw new Error('Wavespeed should be a float or a list');
        }

        // assign wave speed to each pipes
        let i = 0;
        if (generator === 1) {
            for (const [, pipe] of pipesList as Iterable<[string, Pipe]>) {
                pipe.wavev = wavespeedArr[i];
                i++;
            }
        } else {
            for (const pipe of pipesList as Link[]) {
                pipe.wavev = wavespeedArr[i];
                i++;
            }
        }
    }

    set_roughness(roughness: number | number[], pipes: string[] | null = null): void {
        /**
         * Set roughness coefficient for pipes in the network
         *
         * Parameters
         * ----------
         * roughness : float or int or list
         *     If given as float or int, set the value as roughness
         *     for all pipe; If given as list set the corresponding
         *     value to each pipe. Make sure to define it using the
         *     same method (H-W or D-W) as defined in .inp file.
         * pipes : str or list, optional
         *     The list of pipe to define roughness coefficient,
         *     by default all pipe in the network.
         */
        let generator = 0;
        let pipesList: Iterable<[string, Pipe]> | Link[];
        let num_pipes: number;

        if (pipes == null) {
            generator = 1;
            pipesList = this.pipes();
            num_pipes = this.num_pipes;
        } else {
            pipesList = pipes.map(pipe => this.get_link(pipe));
            num_pipes = pipesList.length;
        }

        let roughnessArr: number[];
        if (typeof roughness === 'number') {
            // if roughness is a float, assign it to all mentioned pipes
            roughnessArr = Array(num_pipes).fill(roughness);
        } else if (Array.isArray(roughness)) {
            // if roughness is a list, assign each elements
            // to the respective pipes.
            if (roughness.length !== num_pipes) {
                throw new Error('The length of the roughness \
                input does not equal number of input pipes. ');
            }
            roughnessArr = roughness;
        } else {
            throw new Error('Roughness should be a float or a list');
        }

        // assign roughness to each input pipes
        let i = 0;
        if (generator === 1) {
            for (const [, pipe] of pipesList as Iterable<[string, Pipe]>) {
                pipe.roughness = roughnessArr[i];
                i++;
            }
        } else {
            for (const pipe of pipesList as Link[]) {
                pipe.roughness = roughnessArr[i];
                i++;
            }
        }
    }

    set_time(tf: number, dt: number | null = null): void {
        /**
         * Set time step and duration for the simulation.
         *
         * Parameters
         * ----------
         * tf : float
         *     Simulation period
         * dt : float, optional
         *     time step, by default maximum allowed dt
         */
        if (dt == null) {
            dt = max_time_step(this);
        }
        this.simulation_period = tf;
        discretization(this, dt);
        console.log(`Simulation time step ${this.time_step.toFixed(5)} s`);
    }

    set_time_N(tf: number, N: number = 2): void {
        /**
         * Set time step and duration for the simulation.
         *
         * Parameters
         * ----------
         * tf : float
         *     Simulation period
         * N : integer
         *     Number of segments in the critical pipe
         */
        const dt = max_time_step_N(this, N);
        this.simulation_period = tf;
        discretization_N(this, dt);
        console.log(`Simulation time step ${this.time_step.toFixed(5)} s`);
    }

    add_leak(name: string, coeff: number): void {
        /**
         * Add leak to the transient model
         *
         * Parameters
         * ----------
         * name : str, optional
         *     The name of the leak nodes, by default None
         * coeff : list or float, optional
         *     Emitter coefficient at the leak nodes, by default None
         */

        const leak_node = this.get_node(name);
        leak_node.emitter_coeff += coeff;
        leak_node._leak_status = true;
    }

    add_burst(name: string, ts: number, tc: number, final_burst_coeff: number): void {
        /**
         * Add leak to the transient model
         *
         * Parameters
         * ----------
         * name : str
         *     The name of the leak nodes, by default None
         * ts : float
         *     Burst start time
         * tc : float
         *     Time for burst to fully develop
         * final_burst_coeff : list or float
         *     Final emitter coefficient at the burst nodes
         */

        const burst_node = this.get_node(name);
        burst_node.burst_coeff = burstsetting(this.time_step, this.simulation_period,
                                                ts, tc, final_burst_coeff);
        burst_node.burst_status = true;
    }

    add_blockage(name: string, percentage: number): void {
        /**
         * Add blockage to the transient model
         *
         * Parameters
         * ----------
         * name : str
         *     The name of the blockage nodes, by default None
         * percentage : list or float
         *     The percentage of the blockage flow discharge
         */
        const blockage_node = this.get_node(name);
        blockage_node.block_per = percentage;
        blockage_node.block_status = true;
    }

    valve_closure(name: string, rule: number[], curve: [number, number][] | null = null): void {
        /**
         * Set valve closure rule
         *
         * Parameters
         * ----------
         * name : str
         *     The name of the valve to close
         * rule : list
         *     Contains paramters to define valve operation rule
         *     rule = [tc,ts,se,m]
         *     tc : the duration takes to close the valve [s]
         *     ts : closure start time [s]
         *     se : final open percentage [s]
         *     m  : closure constant [unitless]
         * curve: list
         *     [(open_percentage[i], 1/kl[i]) for i ]
         *     List of open percentage and the corresponding
         *     inverse of valve coefficient
         */

        const valve = this.get_link(name);
        if (valve.link_type.toLowerCase() !== 'valve') {
            throw new Error('The name of valve to operate is not associated with a vale');
        }

        if (typeof valve.status === 'object' && valve.status.name === 'Closed') {
            console.warn(`Valve ${name} is already closed in its initial setting. \
The initial setting has been changed to open to perform the closure.`);
            valve.status = LinkStatus.Open;
        }

        valve.operating = true;
        valve.operation_rule = valveclosing(this.time_step, this.simulation_period, rule);

        if (curve == null) {
            valve.valve_coeff = null;
        } else {
            const p = curve.map(([i,]) => i);
            const kl = curve.map(([, j]) => j);
            valve.valve_coeff = [p, kl];
        }
    }

    valve_opening(name: string, rule: number[], curve: [number, number][] | null = null): void {
        /**
         * Set valve opening rule
         *
         * Parameters
         * ----------
         * name : str
         *     The name of the valve to close
         * rule : list
         *     Contains paramters to define valve operation rule
         *     rule = [tc,ts,se,m]
         *     tc : the duration takes to open the valve [s]
         *     ts : opening start time [s]
         *     se : final open percentage [s]
         *     m  : closure constant [unitless]
         * curve: list
         *     [(open_percentage[i], kl[i]) for i ]
         *     List of open percentage and the corresponding
         *     valve coefficient
         */
        const valve = this.get_link(name);
        if (valve.link_type.toLowerCase() !== 'valve') {
            throw new Error('The name of valve to operate is not associated with a vale');
        }

        if (valve.initial_status.name === 'Open' || valve.initial_status.name === 'Active') {
            console.warn(`Valve ${name} is already open in its initial setting. \
The initial setting has been changed to closed to perform the opening.`);
            valve.status = LinkStatus.Closed;
        }

        valve.operating = true;
        valve.operation_rule = valveopening(this.time_step, this.simulation_period, rule);

        if (curve == null) {
            valve.valve_coeff = null;
        } else {
            const p = curve.map(([i,]) => i);
            const kl = curve.map(([, j]) => j);
            valve.valve_coeff = [p, kl];
        }
    }

    pump_shut_off(name: string, rule: number[]): void {
        /**
         * Set pump shut off rule
         *
         * Parameters
         * ----------
         * name : str
         *     The name of the pump to shut off
         * rule : list
         *     Contains paramaters to define valve operation rule
         *     rule = [tc,ts,se,m]
         *     tc : the duration takes to close the pump [s]
         *     ts : closure start time [s]
         *     se : final open percentage [s]
         *     m  : closure constant [unitless]
         */
        const pump = this.get_link(name);

        if (pump.link_type.toLowerCase() !== 'pump') {
            throw new Error('The name of pump to operate is not associated with a pump');
        }

        if (pump.initial_status.name === 'Closed') {
            console.warn(`Pump ${name} is already closed in its initial setting. \
The initial setting has been changed to open to perform the closure.`);
            pump.status = LinkStatus.Open;
        }
        pump.operating = true;
        pump.operation_rule = pumpclosing(this.time_step, this.simulation_period, rule);
    }

    pump_start_up(name: string, rule: number[]): void {
        /**
         * Set pump start up rule
         *
         * Parameters
         * ----------
         * name : str
         *     The name of the pump to shut off
         * rule : list
         *     Contains paramaters to define valve operation rule
         *     rule = [tc,ts,se,m]
         *     tc : the duration takes to close the valve [s]
         *     ts : closure start time [s]
         *     se : final open percentage [s]
         *     m  : closure constant [unitless]
         */
        const pump = this.get_link(name);
        if (pump.link_type.toLowerCase() !== 'pump') {
            throw new Error('The name of pump to operate is not associated with a pump');
        }

        // Turn the pump on and run initial calculation
        // to get the nominal flow and head
        pump.status = LinkStatus.Open;
        const sim = new this.EpanetSimulator(this);
        const results = sim.run_sim();
        pump.nominal_flow = results.link['flowrate'].loc(0, name);
        const node1 = this.links_map[name].start_node.name;
        const node2 = this.links_map[name].end_node.name;
        pump.nominal_pump_head = Math.abs(results.node['head'].loc(0, node1) -
                        results.node['head'].loc(0, node2));

        // Turn the pump back to closed
        pump.status = LinkStatus.Closed;
        pump.operating = true;
        pump.operation_rule = pumpopening(this.time_step, this.simulation_period, rule);
    }

    add_demand_pulse(name: string, rule: number[]): void {
        /** Add demand pulse to junction
         *
         * Parameters
         * ----------
         * name : str or list
         *     The name of junctions to add demand pulse
         *         rule : list
         *     Contains paramters to define valve operation rule
         * rule = [tc,ts,stay,dp,m]
         *     tc : total duration of the pulse [s]
         *     ts : start time of demand [s]
         *     stay: duration of the demand to stay at peak level [s]
         *     dp : demand pulse multiplier [uniteless]
         */
        const [tc, ts, tp, dp] = rule;
        const demand_node = this.get_node(name);
        demand_node.pulse_coeff = demandpulse(this.time_step, this.simulation_period,
                                                tc, ts, tp, dp);
        demand_node.pulse_status = true;
    }

    add_surge_tank(name: string, shape: number[], tank_type: string = 'open'): void {
        /** Add surge tank
         *
         * Parameters
         * ----------
         * name : str
         *     the name of the node to add a surge tank
         * shape : list
         *     if closed: [As, Ht, Hs]
         *         As : cross-sectional area of the surge tank
         *         Ht : tank height
         *         Hs : initial water height in the surge tank
         *     if open: [As]
         * tank_type : int
         *     type of the surge tank, "closed" or "open",
         *     by default 'open'
         */
        const surge_node = this.get_node(name);
        surge_node.tank_flow = 0;
        shape.push(0.);
        if (tank_type === 'open') {
            surge_node.transient_node_type = 'SurgeTank';
        } else if (tank_type === 'closed') {
            surge_node.transient_node_type = 'Chamber';
            surge_node.tank_height = shape[1];
            surge_node.water_level = shape[shape.length - 2];
        } else {
            console.log("tank type can be 'closed' or 'open'.");
        }
        surge_node.tank_shape = shape; // append tank flow
    }

    detect_pressure_change(name: string, threshold: number, drift: number, show: boolean = false, ax: unknown = null): { ta: number[]; tf: number[]; amp: number[] } {
        /**
         * Detect pressure change in simulation results
         *
         * Parameters
         * ----------
         * name : str
         *     The name of the node
         * threshold : positive number, optional (default = 1)
         *     amplitude threshold for the change in the data.
         * drift : positive number, optional (default = 0)
         *     drift term that prevents any change in the absence of change.
         * show : bool, optional (default = True)
         *     True (1) plots data in matplotlib figure, False (0) don't plot.
         * ax : a matplotlib.axes.Axes instance, optional (default = None).
         */
        const time = this.simulation_timestamps;
        const x = this.get_node(name)._head;
        const [taIdx, tfIdx, amp] = detect_cusum(time, x, threshold, drift,
                 show, null);
        const ta = taIdx.map((i: number) => time[i]);
        const tf_result = tfIdx.map((i: number) => time[i]);
        console.log(`${ta.length} changes detected in pressure results on node ${name}`);

        return { ta, tf: tf_result, amp: [...amp] };
    }

    plot_node_head(name: string | string[], ax: unknown = null): void {
        /**
         * Detect pressure change in simulation results
         *
         * Parameters
         * ----------
         * name : str or list
         *     The name of node
         * ax : a matplotlib.axes.Axes instance, optional (default = None).
         */
        // matplotlib plotting not available in TypeScript
        // This method is a no-op placeholder
        if (!Array.isArray(name)) {
            name = [name];
        }
        const nodes = name.map(i => this.get_node(i));
        const time = this.simulation_timestamps;

        for (let i = 0; i < nodes.length; i++) {
            // ax.plot(time, node._head, lw=2, label=name[i])
            console.log(`Node ${name[i]}: head data available (${nodes[i]._head.length} points)`);
        }
        // plt.xlim([self.simulation_timestamps[0],self.simulation_timestamps[-1]])
        // plt.title('Pressure Head at Node(s) ')
        // plt.xlabel("Time [s]", fontsize=14)
        // plt.ylabel("Pressure Head [m]", fontsize=14)
        // plt.legend(loc='best', framealpha=.5, numpoints=1)
        // plt.grid(False)
        // plt.show()
    }
}
