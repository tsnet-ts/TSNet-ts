declare module 'ndgraph' {
    export interface EdgeAttributes {
        id: number;
        [key: string]: unknown;
    }

    export interface AdjacencyEntry {
        [edgeKey: string]: EdgeAttributes;
    }

    export interface AdjacencyMap {
        [neighbor: string]: AdjacencyEntry;
    }

    export interface EdgeProxy {
        [startNode: string]: {
            [endNode: string]: {
                [edgeKey: string]: EdgeAttributes;
            };
        };
    }

    export interface MultiDiGraph {
        edges: EdgeProxy;
        pred: { [node: string]: AdjacencyMap };
        succ: { [node: string]: AdjacencyMap };
        weight_graph(options: { link_attribute: unknown }): void;
    }
}
