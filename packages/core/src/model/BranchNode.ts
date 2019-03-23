import Node from './Node';
import Doc from './Doc';
import LeafNode from './LeafNode';

export type Parent = Doc | BranchNode;
export type Child = BranchNode | LeafNode;

export default abstract class BranchNode extends Node {
  protected parent: Parent;
  protected children: Child[];

  constructor(parent: Parent) {
    super();
    this.parent = parent;
    this.children = [];
  }

  getParent(): Parent {
    return this.parent;
  }

  getChildren(): Child[] {
    return this.children;
  }

  insertChild(child: Child, offset: number) {
    this.children.splice(offset, 0, child);
  }

  deleteChild(child: Child) {
    const childOffset = this.children.indexOf(child);
    if (childOffset < 0) {
      throw new Error('Cannot delete child, child not found.');
    }
    this.children.splice(childOffset, 1);
  }
};