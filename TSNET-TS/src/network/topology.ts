/**
 * The tsnet.network.topology figure out the topology, i.e.,
 * upstream and downstream adjacent links for each pipe, and
 * store the information in lists.
 */

import type { TransientModel } from './model.ts';
import type { Node } from '../epanet-bridge.ts';

type LinkType = [string, number | string | Node];

export function topology(wn: TransientModel): [
    (number[] | string[])[],
    (number[] | string[])[],
    LinkType[],
    LinkType[]
] {
    /**
     * Figure out the topology of the network
     *
     * Parameters
     * ----------
     * wn : TransientModel
     *     .inp file used for EPAnet simulation
     *
     * Returns
     * -------
     * links1 : list
     *     The id of adjacent pipe on the start node.
     *     The sign represents the direction of the pipe.
     *     + : flowing into the junction
     *     - : flowing out from the junction
     * links2 : list
     *     The id of adjacent pipe on the end node.
     *     The sign represents the direction of the pipe.
     *     + : flowing into the junction
     *     - : flowing out from the junction
     * utype : list
     *     The type of the upstream adjacent links.
     *     If the link is not pipe, the name of that link
     *     will also be included.
     *     If there is no upstream link, the type of the start node
     *     will be recorded.
     * dtype : list
     *     The type of the downstream adjacent links.
     *     If the link is not pipe, the name of that link
     *     will also be included.
     *     If there is no downstream link, the type of the end node
     *     will be recorded.
     */
    const npipe = wn.num_pipes;
    const length = wn.query_link_attribute('length');
    const G = wn.get_graph({ link_weight: length });

    // add 'id' attribute to networkx links
    let i = 1;
    for (const [ln, link] of wn.links()) {
        G.edges[link.start_node.name][link.end_node.name][ln]['id'] = i;
        i++;
    }

    // allocate the parameters
    const links1: (number[] | string[])[] = Array(wn.num_links).fill(0);
    const links2: (number[] | string[])[] = Array(wn.num_links).fill(0);
    const utype: LinkType[] = Array(npipe).fill(null).map(() => ['Pipe', 0]);
    const dtype: LinkType[] = Array(npipe).fill(null).map(() => ['Pipe', 0]);

    // Adjcant pipes for each pipe IN:+; OUT:-
    for (const [, link] of wn.links()) {
        const pn = link.id;
        const startPred: number[] = [];
        for (const [, attr] of Object.entries(G.pred[link.start_node.name])) {
            for (const [, p] of Object.entries(attr)) {
                if (p['id'] !== pn) {
                    startPred.push(p['id'] as number);
                }
            }
        }
        links1[pn - 1] = startPred;

        for (const [, attr] of Object.entries(G.succ[link.start_node.name])) {
            for (const [, p] of Object.entries(attr)) {
                if (p['id'] !== pn) {
                    (links1[pn - 1] as number[]).push(-1 * (p['id'] as number));
                }
            }
        }

        // right (end) adjcant pipes
        const endPred: number[] = [];
        for (const [, attr] of Object.entries(G.pred[link.end_node.name])) {
            for (const [, p] of Object.entries(attr)) {
                if (p['id'] !== pn) {
                    endPred.push(p['id'] as number);
                }
            }
        }
        links2[pn - 1] = endPred;

        for (const [, attr] of Object.entries(G.succ[link.end_node.name])) {
            for (const [, p] of Object.entries(attr)) {
                if (p['id'] !== pn) {
                    (links2[pn - 1] as number[]).push(-1 * (p['id'] as number));
                }
            }
        }
    }

    // figure out downstream type and upstream type
    for (const [, pipe] of wn.pipes()) {
        const pn = pipe.id - 1;
        if ((links1[pn] as number[])?.length) {
            if (Math.max(...(links1[pn] as number[]).map(Math.abs)) > npipe) {
                utype[pn] = [...(function () {
                    for (const [, l] of wn.links()) {
                        if (l.id === Math.abs((links1[pn] as number[])[0])) {
                            return [l.link_type, l.name] as LinkType;
                        }
                    }
                    return ['Pipe', 0] as LinkType;
                })()];

                const valveIdx1 = Math.abs((links1[pn] as number[])[0]) - 1;
                if ((links1[valveIdx1] as number[])?.length &&
                    (links2[valveIdx1] as number[])?.length) {
                    const candidates = [
                        links1[valveIdx1],
                        links2[valveIdx1]
                    ].filter(arr => Math.abs((arr as number[])[0]) - 1 !== pn);
                    links1[pn] = candidates[0];
                } else {
                    links1[pn] = ['End'];
                }
            }
        } else {
            utype[pn] = [wn.get_node(pipe.start_node.name).transient_node_type,
                         pipe.start_node];
        }

        if ((links2[pn] as number[])?.length) {
            if (Math.max(...(links2[pn] as number[]).map(Math.abs)) > npipe) {
                dtype[pn] = [...(function () {
                    for (const [, l] of wn.links()) {
                        if (l.id === Math.abs((links2[pn] as number[])[0])) {
                            return [l.link_type, l.name] as LinkType;
                        }
                    }
                    return ['Pipe', 0] as LinkType;
                })()];

                const valveIdx2 = Math.abs((links2[pn] as number[])[0]) - 1;
                if ((links1[valveIdx2] as number[])?.length &&
                    (links2[valveIdx2] as number[])?.length) {
                    const candidates = [
                        links1[valveIdx2],
                        links2[valveIdx2]
                    ].filter(arr => Math.abs((arr as number[])[0]) - 1 !== pn);
                    links2[pn] = candidates[0];
                } else {
                    links2[pn] = ['End'];
                }
            }
        } else {
            dtype[pn] = [wn.get_node(pipe.end_node.name).transient_node_type,
                         pipe.end_node];
        }
    }

    return [links1, links2, utype, dtype];
}
