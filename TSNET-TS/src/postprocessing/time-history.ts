/**
 * The tsnet.postprocessing.time_history module contains functions
 * to plot the time history of head and velocity at the start and
 * end point of a pipe
 */

import type { TransientModel } from '../network/model.ts';

export function plot_head_history(pipe: string, H: number[][], wn: TransientModel, tt: number[]): void {
    /**
     * Plot Head history on the start and end node of a pipe
     *
     * Parameters
     * ----------
     * pipe : str
     *     Name of the pipe where you want to report the head
     * H : list
     *     Head results
     * wn : TransientModel
     *     Network
     * tt : list
     *     Simulation timestamps
     */

    const pipeid = wn.get_link(pipe).id - 1;
    // plt.figure(figsize=(10,4), dpi=80, facecolor='w', edgecolor='k')
    // plt.plot(tt,H[pipeid][0,:], 'b-',label='Start Node')
    // plt.plot(tt,H[pipeid][-1,:], 'r-',label='End Node')
    // plt.xlim([tt[0],tt[-1]])
    // plt.title('Pressure Head of Pipe %s '%pipe)
    // plt.xlabel("Time")
    // plt.ylabel("Pressure Head (m)")
    // plt.legend(loc='best')
    // plt.grid(True)
    // plt.show()
    console.log(`Pressure Head of Pipe ${pipe}`);
    console.log(`Start Node: ${H[pipeid][0]}, End Node: ${H[pipeid][H[pipeid].length - 1]}`);
}

export function plot_velocity_history(pipe: string, V: number[][], wn: TransientModel, tt: number[]): void {
    /**
     * Plot Velocity history on the start and end node of a pipe
     *
     * Parameters
     * ----------
     * pipe : str
     *     Name of the pipe where you want to report the head
     * V : list
     *     velocity results
     * wn : TransientModel
     *     Network
     * tt : list
     *     Simulation timestamps
     */

    const pipeid = wn.get_link(pipe).id - 1;
    // plt.figure(figsize=(10,4), dpi=80, facecolor='w', edgecolor='k')
    // plt.plot(tt,V[pipeid][0,:], 'b-',label='Start Node')
    // plt.plot(tt,V[pipeid][-1,:], 'r-',label='End Node')
    // plt.xlim([tt[0],tt[-1]])
    // plt.title('Velocity Head of Pipe %s ' %pipe)
    // plt.xlabel("Time")
    // plt.ylabel("Velocity (m/s)")
    // plt.legend(loc='best')
    // plt.grid(True)
    // plt.show()
    console.log(`Velocity Head of Pipe ${pipe}`);
    console.log(`Start Node: ${V[pipeid][0]}, End Node: ${V[pipeid][V[pipeid].length - 1]}`);
}
