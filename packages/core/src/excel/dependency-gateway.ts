import type { SelectionContext } from "./context-snapshot";

export interface DependencyGraphNode {
  address: string;
}

export interface DependencyEdge {
  from: DependencyGraphNode;
  to: DependencyGraphNode;
}

export interface SelectionDependencyGraph {
  rootSelectionAddress: string;
  nodes: DependencyGraphNode[];
  edges: DependencyEdge[];
  truncated: boolean;
}

export interface DependencyGateway {
  getSelectionDependencyGraph(
    selection: SelectionContext,
    maxNodes: number
  ): Promise<SelectionDependencyGraph>;
}
