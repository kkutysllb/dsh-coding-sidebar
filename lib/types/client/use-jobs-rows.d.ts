import type { Context, SidebarJobView } from '../context-types.ts';
/**
 * Watch the given Sessions' job rows and return the shared roster snapshot.
 * @param ctx - the client cordis context (the service is optional).
 * @param sessionIds - Sessions whose rows this surface shows; watching stops on change/unmount.
 * @returns rows keyed by Session id, or undefined when the service is absent.
 */
export declare function useJobsRows(ctx: Context, sessionIds: readonly string[]): Readonly<Record<string, readonly SidebarJobView[]>> | undefined;
