declare module 'react-graph-vis' {
  import { Component } from 'react';
  import { Network, Options, Node, Edge } from 'vis-network';

  export interface GraphData {
    nodes: Node[];
    edges: Edge[];
  }

  export interface GraphEvents {
    [eventName: string]: (params?: any) => void;
  }

  export interface GraphProps {
    graph: GraphData;
    options?: Options;
    events?: GraphEvents;
    getNetwork?: (network: Network) => void;
    style?: React.CSSProperties;
  }

  export default class Graph extends Component<GraphProps> {}
}

