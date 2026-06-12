/**
 * Bridge module wrapping epanet-js (low-level EPANET toolkit)
 * to provide a WNTR-like high-level API used by TSNET-TS.
 */

import {
    Workspace, Project,
    CountType, NodeType, LinkType as EpanetLinkType,
    NodeProperty, LinkProperty,
    InitHydOption, DemandModel, FlowUnits
} from 'epanet-js';
import type { NDArray } from 'numpy-ts';
import type { MultiDiGraph, EdgeProxy, AdjacencyMap } from 'ndgraph';

// ============ Interfaces ============

export interface Node {
    id: number;
    name: string;
    node_type: string;
    elevation: number;
    _leak_status: boolean;
    burst_status: boolean;
    blockage_status: boolean;
    pulse_status: boolean;
    emitter_coeff: number;
    block_per: number;
    transient_node_type: string;
    burst_coeff: NDArray;
    block_status: boolean;
    pulse_coeff: NDArray;
    tank_flow: number;
    tank_height: number;
    water_level: number;
    tank_shape: number[];
    _head: number[];
    initial_head: number;
    demand_coeff: number;
    base_demand_coeff: number;
    demand_discharge: number[];
    emitter_discharge: number[];
    air_constant: number;
    water_level_timeseries: number[];
    tank_flow_timeseries: number[];
    add_leak(model: WaterNetworkModel, options: { area: number; discharge_coeff: number; start_time: number }): void;
    [key: string]: unknown;
}

export interface Link {
    id: number;
    name: string;
    link_type: string;
    status: LinkStatus | { name: string };
    initial_status: { name: string };
    operating: boolean;
    operation_rule: NDArray | null;
    start_node: Node;
    end_node: Node;
    valve_coeff: [number[], number[]] | null;
    nominal_flow: number;
    nominal_pump_head: number;
    initial_flow: number;
    curve_coef: [number, number, number];
    get_pump_curve(): { points: [number, number][] };
    [key: string]: unknown;
}

export interface Pipe extends Link {
    length: number;
    diameter: number;
    roughness: number;
    wavev: number;
    area: number;
    theta: number;
    number_of_segments: number;
    start_node_head: number[];
    start_node_velocity: number[];
    start_node_flowrate: number[];
    end_node_head: number[];
    end_node_velocity: number[];
    end_node_flowrate: number[];
    initial_head: number[];
    initial_velocity: number[];
    initial_Re: number;
    roughness_height: number;
}

export enum LinkStatus {
    Open = 1,
    Closed = 0,
}

export interface SimulationResults {
    link: { [key: string]: { loc: (time: number, name: string) => number } };
    node: { [key: string]: { loc: (time: number, name: string) => number } };
}

export interface EpanetSimulator {
    run_sim(): SimulationResults;
}

// ============ Helpers ============

const EPANET_ID_LENGTH = 32;
const EPANET_TITLE_BYTES = 240;
const EPANET_PATH_BYTES = 260;
const epanetTextDecoder = new TextDecoder('latin1');

function getLinkTypeName(lt: EpanetLinkType): string {
    switch (lt) {
        case EpanetLinkType.Pipe: case EpanetLinkType.CVPipe: return 'Pipe';
        case EpanetLinkType.Pump: return 'Pump';
        default: return 'Valve';
    }
}

function getNodeTypeName(nt: NodeType): string {
    switch (nt) {
        case NodeType.Junction: return 'Junction';
        case NodeType.Reservoir: return 'Reservoir';
        case NodeType.Tank: return 'Tank';
        default: return 'Junction';
    }
}

/**
 * Get the conversion factor from EPANET flow units to m³/s.
 */
function getFlowConversionFactor(units: FlowUnits): number {
    switch (units) {
        case FlowUnits.CFS: return 0.0283168;       // ft³/s → m³/s
        case FlowUnits.GPM: return 6.30902e-5;      // gal/min → m³/s
        case FlowUnits.MGD: return 0.0438126;       // Mgal/day → m³/s
        case FlowUnits.IMGD: return 0.0526168;      // imp Mgal/day → m³/s
        case FlowUnits.AFD: return 0.0142764;       // acre-ft/day → m³/s
        case FlowUnits.LPS: return 0.001;           // L/s → m³/s
        case FlowUnits.LPM: return 1.66667e-5;     // L/min → m³/s
        case FlowUnits.MLD: return 0.0115741;       // ML/day → m³/s
        case FlowUnits.CMH: return 2.77778e-4;     // m³/h → m³/s
        case FlowUnits.CMD: return 1.15741e-5;     // m³/day → m³/s
        default: return 0.001; // default to LPS
    }
}

/**
 * Check if flow units are US customary (lengths in feet, diameters in inches).
 */
function isUSCustomary(units: FlowUnits): boolean {
    return units === FlowUnits.CFS || units === FlowUnits.GPM ||
           units === FlowUnits.MGD || units === FlowUnits.IMGD ||
           units === FlowUnits.AFD;
}

/**
 * Get conversion factor for length/head/elevation/velocity from EPANET units to SI (meters).
 * US customary: feet → meters (0.3048)
 * SI: already meters (1.0)
 */
function getLengthConversionFactor(units: FlowUnits): number {
    return isUSCustomary(units) ? 0.3048 : 1.0;
}

/**
 * Get conversion factor for pipe diameter from EPANET units to meters.
 * US customary: inches → meters (0.0254)
 * SI: mm → meters (0.001)
 */
function getDiameterConversionFactor(units: FlowUnits): number {
    return isUSCustomary(units) ? 0.0254 : 0.001;
}

function toFloat32(value: number): number {
    return new Float32Array([value])[0];
}

function mulFloat32(left: number, right: number): number {
    return Math.fround(Math.fround(left) * Math.fround(right));
}

function makeAccessor(data: Map<string, number>): { loc: (time: number, name: string) => number } {
    return {
        loc: (_time: number, name: string): number => {
            const val = data.get(name);
            if (val === undefined) throw new Error(`Result not found for: ${name}`);
            return val;
        }
    };
}

function readEpanetString(bytes: Uint8Array, offset: number, length: number): string {
    const raw = bytes.subarray(offset, offset + length);
    const nulIndex = raw.indexOf(0);
    const slice = nulIndex === -1 ? raw : raw.subarray(0, nulIndex);
    return epanetTextDecoder.decode(slice);
}

function readBinaryResults(
    bytes: Uint8Array,
    flowFactor: number,
    lengthFactor: number
): SimulationResults {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 0;

    const readInt32 = (): number => {
        const value = view.getInt32(offset, true);
        offset += 4;
        return value;
    };
    const readFloat32 = (): number => {
        const value = view.getFloat32(offset, true);
        offset += 4;
        return value;
    };

    const prolog = Array.from({ length: 15 }, () => readInt32());
    const nnodes = prolog[2];
    const ntanks = prolog[3];
    const nlinks = prolog[4];
    const npumps = prolog[5];

    offset += EPANET_TITLE_BYTES;
    offset += EPANET_PATH_BYTES;
    offset += EPANET_PATH_BYTES;
    offset += EPANET_ID_LENGTH; // chemical
    offset += EPANET_ID_LENGTH; // quality units

    const nodeNames: string[] = [];
    for (let i = 0; i < nnodes; i++) {
        nodeNames.push(readEpanetString(bytes, offset, EPANET_ID_LENGTH));
        offset += EPANET_ID_LENGTH;
    }

    const linkNames: string[] = [];
    for (let i = 0; i < nlinks; i++) {
        linkNames.push(readEpanetString(bytes, offset, EPANET_ID_LENGTH));
        offset += EPANET_ID_LENGTH;
    }

    offset += 4 * nlinks; // linkstart
    offset += 4 * nlinks; // linkend
    offset += 4 * nlinks; // linktype
    offset += 4 * ntanks; // tankidxs
    offset += 4 * ntanks; // tankarea
    offset += 4 * nnodes; // elevation
    offset += 4 * nlinks; // linklen
    offset += 4 * nlinks; // diameter
    offset += npumps * (4 + 6 * 4); // pump energy blocks
    offset += 4; // peakenergy

    const nodeDemands = new Map<string, number>();
    for (const name of nodeNames) {
        nodeDemands.set(name, mulFloat32(readFloat32(), flowFactor));
    }

    const nodeHeads = new Map<string, number>();
    for (const name of nodeNames) {
        nodeHeads.set(name, mulFloat32(readFloat32(), lengthFactor));
    }

    offset += 4 * nnodes; // pressure
    offset += 4 * nnodes; // quality

    const linkFlows = new Map<string, number>();
    for (const name of linkNames) {
        linkFlows.set(name, mulFloat32(readFloat32(), flowFactor));
    }

    const linkVelocities = new Map<string, number>();
    for (const name of linkNames) {
        linkVelocities.set(name, mulFloat32(readFloat32(), lengthFactor));
    }

    return {
        node: {
            head: makeAccessor(nodeHeads),
            demand: makeAccessor(nodeDemands),
        },
        link: {
            flowrate: makeAccessor(linkFlows),
            velocity: makeAccessor(linkVelocities),
        }
    };
}

function readDirectResults(
    project: Project,
    flowFactor: number,
    lengthFactor: number
): SimulationResults {
    const nodeHeads = new Map<string, number>();
    const nodeDemands = new Map<string, number>();
    const nodeCount = project.getCount(CountType.NodeCount);
    for (let i = 1; i <= nodeCount; i++) {
        const name = project.getNodeId(i);
        nodeHeads.set(name, project.getNodeValue(i, NodeProperty.Head) * lengthFactor);
        nodeDemands.set(name, project.getNodeValue(i, NodeProperty.Demand) * flowFactor);
    }

    const linkFlows = new Map<string, number>();
    const linkVelocities = new Map<string, number>();
    const linkCount = project.getCount(CountType.LinkCount);
    for (let i = 1; i <= linkCount; i++) {
        const name = project.getLinkId(i);
        linkFlows.set(name, project.getLinkValue(i, LinkProperty.Flow) * flowFactor);
        linkVelocities.set(name, project.getLinkValue(i, LinkProperty.Velocity) * lengthFactor);
    }

    return {
        node: {
            head: makeAccessor(nodeHeads),
            demand: makeAccessor(nodeDemands),
        },
        link: {
            flowrate: makeAccessor(linkFlows),
            velocity: makeAccessor(linkVelocities),
        }
    };
}

// ============ EpanetSimulator Implementation ============

class EpanetSimulatorImpl implements EpanetSimulator {
    private model: WaterNetworkModel;

    constructor(model: WaterNetworkModel) {
        this.model = model;
    }

    run_sim(): SimulationResults {
        const project = this.model._project!;
        const ws = this.model._ws;
        const flowFactor = this.model._flowConversionFactor;
        const lengthFactor = this.model._lengthFactor;

        // Set demand model
        const dm = this.model.options.hydraulic.demand_model.toUpperCase();
        if (dm === 'PDD' || dm === 'PDA') {
            project.setDemandModel(DemandModel.PDA, 0, 0.1, 0.5);
        } else {
            project.setDemandModel(DemandModel.DDA, 0, 0, 0);
        }

        try {
            project.solveH();
            project.solveQ();
            project.report();

            if (ws == null) {
                throw new Error('Workspace unavailable for binary output read');
            }

            const output = ws.readFile('output.bin', 'binary');
            return readBinaryResults(new Uint8Array(output), flowFactor, lengthFactor);
        } catch {
            project.openH();
            project.initH(InitHydOption.NoSave);
            project.runH();
            const directResults = readDirectResults(project, flowFactor, lengthFactor);
            project.closeH();
            return directResults;
        }
    }
}

// ============ WaterNetworkModel ============

export class WaterNetworkModel {
    num_pipes: number = 0;
    num_links: number = 0;
    links_map: { [name: string]: Link } = {};
    options = { hydraulic: { demand_model: 'DD' } };

    _project: Project | null = null;
    _ws: Workspace | null = null;
    _flowConversionFactor: number = 0.001; // default LPS → m³/s
    _lengthFactor: number = 1.0;            // length/head/velocity: ft→m or 1.0
    _diameterFactor: number = 0.001;        // diameter: in→m or mm→m
    protected _nodes: Map<string, Node> = new Map();
    protected _links: Map<string, Link> = new Map();
    protected _pipes: Map<string, Pipe> = new Map();
    protected _pumps: Map<string, Link> = new Map();
    protected _valves: Map<string, Link> = new Map();
    protected _inp_file: string = '';

    EpanetSimulator: new (model: WaterNetworkModel) => EpanetSimulator = EpanetSimulatorImpl;

    constructor() {
        // Use static create() for initialization
    }

    static async create(inp_file: string): Promise<WaterNetworkModel> {
        const model = new WaterNetworkModel();
        model._inp_file = inp_file;
        await model._initialize(inp_file);
        return model;
    }

    static async createFromContent(inpContent: string): Promise<WaterNetworkModel> {
        const model = new WaterNetworkModel();
        model._inp_file = '<from-content>';
        await model._initializeFromContent(inpContent);
        return model;
    }

    protected async _initialize(inp_file: string): Promise<void> {
        // Read inp file from filesystem and write to WASM virtual FS
        const fs = await import('fs');
        const path = await import('path');
        const resolvedPath = path.resolve(inp_file);
        const inpContent = fs.readFileSync(resolvedPath, 'utf-8');
        await this._initializeFromContent(inpContent);
    }

    protected async _initializeFromContent(inpContent: string): Promise<void> {
        const ws = new Workspace();
        await ws.loadModule();
        this._ws = ws;

        ws.writeFile('model.inp', inpContent);

        const project = new Project(ws);
        project.open('model.inp', 'report.rpt', 'output.bin');
        this._project = project;

        // Determine unit conversion factors
        const flowUnits = project.getFlowUnits();
        this._flowConversionFactor = getFlowConversionFactor(flowUnits);
        this._lengthFactor = getLengthConversionFactor(flowUnits);
        this._diameterFactor = getDiameterConversionFactor(flowUnits);

        this._parseNodes(project);
        this._parseLinks(project);
    }

    private _parseNodes(project: Project): void {
        const nodeCount = project.getCount(CountType.NodeCount);

        for (let i = 1; i <= nodeCount; i++) {
            const name = project.getNodeId(i);
            const nodeType = project.getNodeType(i);
            const elevation = project.getNodeValue(i, NodeProperty.Elevation) * this._lengthFactor;

            const node: Node = {
                id: i,
                name,
                node_type: getNodeTypeName(nodeType),
                elevation,
                _leak_status: false,
                burst_status: false,
                blockage_status: false,
                pulse_status: false,
                emitter_coeff: 0,
                block_per: 0,
                transient_node_type: getNodeTypeName(nodeType),
                burst_coeff: null as unknown as NDArray,
                block_status: false,
                pulse_coeff: null as unknown as NDArray,
                tank_flow: 0,
                tank_height: 0,
                water_level: 0,
                tank_shape: [],
                _head: [],
                initial_head: 0,
                demand_coeff: 0,
                base_demand_coeff: 0,
                demand_discharge: [],
                emitter_discharge: [],
                air_constant: 0,
                water_level_timeseries: [],
                tank_flow_timeseries: [],
                add_leak(_model, _options) {
                    // handled via emitter_coeff
                }
            };
            this._nodes.set(name, node);
        }
    }

    private _parseLinks(project: Project): void {
        const linkCount = project.getCount(CountType.LinkCount);
        let pipeCount = 0;
        const flowFactor = this._flowConversionFactor;
        const lengthFactor = this._lengthFactor;

        for (let i = 1; i <= linkCount; i++) {
            const name = project.getLinkId(i);
            const linkType = project.getLinkType(i);
            const linkTypeName = getLinkTypeName(linkType);
            const { node1, node2 } = project.getLinkNodes(i);
            const startNodeName = project.getNodeId(node1);
            const endNodeName = project.getNodeId(node2);
            const startNode = this._nodes.get(startNodeName)!;
            const endNode = this._nodes.get(endNodeName)!;

            const initStatus = project.getLinkValue(i, LinkProperty.InitStatus);
            const statusName = initStatus === 1 ? 'Open' : 'Closed';

            const projectRef = project;
            const linkIdx = i;
            let cachedPumpCurvePoints: [number, number][] | null = null;

            const link: Link = {
                id: i,
                name,
                link_type: linkTypeName,
                status: initStatus === 1 ? LinkStatus.Open : LinkStatus.Closed,
                initial_status: { name: statusName },
                operating: false,
                operation_rule: null,
                start_node: startNode,
                end_node: endNode,
                valve_coeff: null,
                nominal_flow: 0,
                nominal_pump_head: 0,
                initial_flow: 0,
                curve_coef: [0, 0, 0],
                get_pump_curve() {
                    if (linkTypeName !== 'Pump') return { points: [] };
                    if (cachedPumpCurvePoints === null) {
                        const curveIdx = projectRef.getHeadCurveIndex(linkIdx);
                        if (curveIdx === 0) {
                            cachedPumpCurvePoints = [];
                        } else {
                            const curveLen = projectRef.getCurveLenth(curveIdx);
                            cachedPumpCurvePoints = [];
                            for (let p = 1; p <= curveLen; p++) {
                                const { x, y } = projectRef.getCurveValue(curveIdx, p);
                                cachedPumpCurvePoints.push([x * flowFactor, y * lengthFactor]); // Q: flow units → m³/s, H: length units → m
                            }
                        }
                    }
                    return { points: cachedPumpCurvePoints };
                }
            };

            this._links.set(name, link);
            this.links_map[name] = link;

            if (linkTypeName === 'Pipe') {
                const length = project.getLinkValue(i, LinkProperty.Length) * this._lengthFactor;
                const diameter = project.getLinkValue(i, LinkProperty.Diameter) * this._diameterFactor;
                const roughness = project.getLinkValue(i, LinkProperty.Roughness);

                const pipe: Pipe = {
                    ...link,
                    length,
                    diameter,
                    roughness,
                    wavev: 0,
                    area: 0,
                    theta: 0,
                    number_of_segments: 0,
                    start_node_head: [],
                    start_node_velocity: [],
                    start_node_flowrate: [],
                    end_node_head: [],
                    end_node_velocity: [],
                    end_node_flowrate: [],
                    initial_head: [],
                    initial_velocity: [],
                    initial_Re: 0,
                    roughness_height: 0,
                };
                this._pipes.set(name, pipe);
                this._links.set(name, pipe);
                this.links_map[name] = pipe;
                pipeCount++;
            } else if (linkTypeName === 'Pump') {
                this._pumps.set(name, link);
            } else if (linkTypeName === 'Valve') {
                this._valves.set(name, link);
            }
        }

        this.num_pipes = pipeCount;
        this.num_links = linkCount;
    }

    // ============ Iterators ============

    *links(): Generator<[string, Link]> {
        yield* this._links.entries();
    }

    *pipes(): Generator<[string, Pipe]> {
        yield* this._pipes.entries();
    }

    *pumps(): Generator<[string, Link]> {
        yield* this._pumps.entries();
    }

    *nodes(): Generator<[string, Node]> {
        yield* this._nodes.entries();
    }

    *valves(): Generator<[string, Link]> {
        yield* this._valves.entries();
    }

    // ============ Accessors ============

    get_link(name: string): Link {
        const link = this._links.get(name);
        if (!link) throw new Error(`Link '${name}' not found`);
        return link;
    }

    get_node(name: string): Node {
        const node = this._nodes.get(name);
        if (!node) throw new Error(`Node '${name}' not found`);
        return node;
    }

    query_link_attribute(attribute: string): { [name: string]: number } {
        const result: { [name: string]: number } = {};
        for (const [name, link] of this._links) {
            result[name] = (link as Record<string, unknown>)[attribute] as number ?? 0;
        }
        return result;
    }

    get_graph(_options?: { link_weight: { [name: string]: number } }): MultiDiGraph {
        const edges: EdgeProxy = {};
        const pred: { [node: string]: AdjacencyMap } = {};
        const succ: { [node: string]: AdjacencyMap } = {};

        for (const [name] of this._nodes) {
            pred[name] = {};
            succ[name] = {};
            edges[name] = {};
        }

        for (const [linkName, link] of this._links) {
            const sn = link.start_node.name;
            const en = link.end_node.name;

            if (!edges[sn]) edges[sn] = {};
            if (!edges[sn][en]) edges[sn][en] = {};
            edges[sn][en][linkName] = {
                id: link.id,
                weight: _options?.link_weight?.[linkName] ?? 0
            };

            if (!pred[en][sn]) pred[en][sn] = {};
            pred[en][sn][linkName] = { id: link.id };

            if (!succ[sn][en]) succ[sn][en] = {};
            succ[sn][en][linkName] = { id: link.id };
        }

        return {
            edges,
            pred,
            succ,
            weight_graph() { /* no-op */ }
        };
    }
}
