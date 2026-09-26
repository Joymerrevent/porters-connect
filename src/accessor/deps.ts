// What a resource accessor is handed: how and where to send, and — for a partition-bound
// resource — the partition. Master resources that send no `partition` of their own take less.

import type { AccessPoint } from "../http/access-point";
import type { Requester } from "../http/requester";

/**
 * How to reach PORTERS: how to send (requester) and where to send (access point — ADR-0047).
 * Enough on its own for a Read that does not send `partition`: Partition Read discovers
 * partitions, so it has none to bind, and a master's shared sending never reads one (each master
 * sends its own `partition` through `params`).
 */
export type ConnectionDeps = {
  requester: Requester;
  accessPoint: AccessPoint;
};

/**
 * What a partition-bound resource accessor is handed: the {@link ConnectionDeps} and the partition
 * it is bound to.
 */
export type PartitionBoundConnectionDeps = ConnectionDeps & {
  partition: number;
};
