import type { NodeIdInternal } from './node.js';


export type Message<Data, Info> = {
  type: 'declare';
  node: SerializedNode<Data, Info>;
} | {
  type: 'info';
  node: SerializedNode<Data, Info>;
} | {
  type: 'close';
  id: NodeIdInternal;
} | {
  type: 'update';
  id: NodeIdInternal;
  data: SerializedNode<Data, never>['data'];
} | {
  type: 'order-close';
  id: NodeIdInternal;
};

export interface SerializedNode<Data, Info> {
  id: NodeIdInternal;
  data: {
    parentId: NodeIdInternal | null;
    screenId: NodeIdInternal | null;

    focused: boolean;
    visible: boolean;

    user: Data;
  };
  info: {
    controlled: boolean;
    popup: boolean;
    user: Info;
  };
}
