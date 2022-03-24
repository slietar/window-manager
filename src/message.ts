import type { ScreenId } from './manager.js';
import type { NodeId } from './node.js';


export type Message<Data, Info> = {
  type: 'declare';
  node: SerializedNode<Data, Info>;
} | {
  type: 'info';
  node: SerializedNode<Data, Info>;
} | {
  type: 'close';
  id: NodeId;
} | {
  type: 'update';
  id: NodeId;
  data: SerializedNode<Data, never>['data'];
} | {
  type: 'order-close';
  id: NodeId;
} | {
  type: 'run';
  id: NodeId;
  name: string;
  args: unknown[];
};

export interface SerializedNode<Data, Info> {
  id: NodeId;
  data: {
    parentId: NodeId | null;
    screenId: ScreenId | null;

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
