export function print_time_delta(inputSeconds: number): string {
    let seconds = Math.floor(inputSeconds);
    const days = Math.floor(seconds / 86400); seconds = seconds % 86400;
    const hours = Math.floor(seconds / 3600); seconds = seconds % 3600;
    const minutes = Math.floor(seconds / 60); seconds = seconds % 60;

    if (days > 0) {
        return `${days}d${hours}h${minutes}m${seconds}s`;
    } else if (hours > 0) {
        return `${hours}h${minutes}m${seconds}s`;
    } else if (minutes > 0) {
        return `${minutes}m${seconds}s`;
    } else {
        return `${seconds}s`;
    }
}