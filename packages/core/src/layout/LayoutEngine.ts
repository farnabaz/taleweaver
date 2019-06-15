import Editor from '../Editor';
import TreeSyncer from '../utils/TreeSyncer';
import { RenderStateUpdatedEvent, LayoutStateUpdatedEvent } from '../dispatch/events';
import RenderNode from '../render/RenderNode';
import DocRenderNode from '../render/DocRenderNode';
import BlockRenderNode from '../render/BlockRenderNode';
import InlineRenderNode from '../render/InlineRenderNode';
import AtomicRenderNode from '../render/AtomicRenderNode';
import Box from './Box';
import DocBox from './DocBox';
import PageFlowBox from './PageFlowBox';
import BlockBox from './BlockBox';
import LineFlowBox from './LineFlowBox';
import InlineBox from './InlineBox';
import AtomicBox from './AtomicBox';

function bumpVersionForBlockBoxAndDescendents(blockBox: BlockBox, version: number) {
  blockBox.setVersion(version);
  blockBox.getChildren().forEach(lineFlowBox => {
    lineFlowBox.setVersion(version);
    lineFlowBox.getChildren().forEach(inlineBox => {
      inlineBox.setVersion(version);
      inlineBox.getChildren().forEach(atomicBox => {
        atomicBox.setVersion(version);
      });
    });
  });
}

class RenderToLayoutTreeSyncer extends TreeSyncer<RenderNode, Box> {
  protected editor: Editor;
  protected lastVersion: number;
  protected updatedPageFlowBoxes: PageFlowBox[];
  protected updatedLineFlowBoxes: LineFlowBox[];

  constructor(editor: Editor, lastVersion: number) {
    super();
    this.editor = editor;
    this.lastVersion = lastVersion;
    this.updatedPageFlowBoxes = [];
    this.updatedLineFlowBoxes = [];
  }

  getUpdatedPageFlowBoxes(): PageFlowBox[] {
    return Array.from(this.updatedPageFlowBoxes);
  }

  getUpdatedLineFlowBoxes(): LineFlowBox[] {
    return Array.from(this.updatedLineFlowBoxes);
  }

  getSrcNodeChildren(node: RenderNode): RenderNode[] {
    if (node instanceof DocRenderNode) {
      return node.getChildren();
    }
    if (node instanceof BlockRenderNode) {
      return node.getChildren();
    }
    if (node instanceof InlineRenderNode) {
      return node.getChildren();
    }
    return [];
  }

  getDstNodeChildren(node: Box): Box[] {
    if (node instanceof DocBox) {
      const children: BlockBox[] = [];
      node.getChildren().map(child => {
        children.push(...child.getChildren());
      });
      return children;
    }
    if (node instanceof BlockBox) {
      const children: InlineBox[] = [];
      node.getChildren().map(child => {
        children.push(...child.getChildren());
      });
      return children;
    }
    if (node instanceof InlineBox) {
      return [...node.getChildren()];
    }
    return [];
  }

  findSrcNodeInDstNodes(srcNode: RenderNode, dstNodes: Box[]): number {
    const id = srcNode.getID();
    const offset = dstNodes.findIndex(n => n.getRenderNodeID() === id);
    return offset;
  }

  insertNode(parent: Box, srcNode: RenderNode, offset: number): Box {
    const elementConfig = this.editor.getConfig().getElementConfig();
    if (parent instanceof DocBox && srcNode instanceof BlockRenderNode) {
      const BlockBoxClass = elementConfig.getBlockBoxClass(srcNode.getType());
      const blockBox = new BlockBoxClass(this.editor, srcNode.getID());
      if (!(blockBox instanceof BlockBox)) {
        throw new Error('Error inserting box, expecting block box.');
      }
      blockBox.setVersion(srcNode.getVersion());
      const pageFlowBoxes = parent.getChildren();
      let cumulatedOffset = 0;
      let inserted = false;
      for (let n = 0, nn = pageFlowBoxes.length; n < nn; n++) {
        const pageFlowBox = pageFlowBoxes[n];
        if (cumulatedOffset + pageFlowBox.getChildren().length >= offset) {
          pageFlowBox.insertChild(blockBox, offset - cumulatedOffset);
          this.updatedPageFlowBoxes.push(pageFlowBox);
          inserted = true;
          break;
        }
        cumulatedOffset += pageFlowBox.getChildren().length;
      }
      if (!inserted) {
        const pageFlowBox = new PageFlowBox(this.editor);
        parent.insertChild(pageFlowBox, pageFlowBoxes.length);
        pageFlowBox.insertChild(blockBox, 0);
        this.updatedPageFlowBoxes.push(pageFlowBox);
      }
      return blockBox;
    }
    if (parent instanceof BlockBox && srcNode instanceof InlineRenderNode) {
      const InlineBoxClass = elementConfig.getInlineBoxClass(srcNode.getType());
      const inlineBox = new InlineBoxClass(this.editor, srcNode.getID());
      if (!(inlineBox instanceof InlineBox)) {
        throw new Error('Error inserting box, expecting inline box.');
      }
      inlineBox.setVersion(srcNode.getVersion());
      const lineFlowBoxes = parent.getChildren();
      let cumulatedOffset = 0;
      let inserted = false;
      for (let n = 0, nn = lineFlowBoxes.length; n < nn; n++) {
        const lineFlowBox = lineFlowBoxes[n];
        if (cumulatedOffset + lineFlowBox.getChildren().length >= offset) {
          lineFlowBox.insertChild(inlineBox, offset - cumulatedOffset);
          this.updatedLineFlowBoxes.push(lineFlowBox);
          inserted = true;
          break;
        }
        cumulatedOffset += lineFlowBox.getChildren().length;
      }
      if (!inserted) {
        const lineFlowBox = new LineFlowBox(this.editor, parent.getWidth());
        parent.insertChild(lineFlowBox, lineFlowBoxes.length);
        lineFlowBox.insertChild(inlineBox, 0);
        this.updatedLineFlowBoxes.push(lineFlowBox);
      }
      return inlineBox;
    }
    if (parent instanceof InlineBox && srcNode instanceof AtomicRenderNode) {
      const AtomicBoxClass = elementConfig.getAtomicBoxClass(srcNode.getType());
      const atomicBox = new AtomicBoxClass(this.editor, srcNode.getID());
      if (!(atomicBox instanceof AtomicBox)) {
        throw new Error('Error inserting box, expecting atomic box.');
      }
      atomicBox.setVersion(srcNode.getVersion());
      parent.insertChild(atomicBox, offset);
      return atomicBox;
    }
    throw new Error('Error inserting box, type mismatch.');
  }

  deleteNode(parent: Box, node: Box) {
    if (parent instanceof DocBox && node instanceof BlockBox) {
      const pageFlowBoxes = parent.getChildren();
      for (let n = 0, nn = pageFlowBoxes.length; n < nn; n++) {
        const pageFlowBox = pageFlowBoxes[n];
        if (pageFlowBox.getChildren().indexOf(node) >= 0) {
          pageFlowBox.deleteChild(node);
          if (pageFlowBox.getChildren().length === 0) {
            parent.deleteChild(pageFlowBox);
          } else {
            this.updatedPageFlowBoxes.push(pageFlowBox);
          }
          break;
        }
      }
      return;
    }
    if (parent instanceof BlockBox && node instanceof InlineBox) {
      const lineFlowBoxes = parent.getChildren();
      for (let n = 0, nn = lineFlowBoxes.length; n < nn; n++) {
        const lineFlowBox = lineFlowBoxes[n];
        if (lineFlowBox.getChildren().indexOf(node) >= 0) {
          lineFlowBox.deleteChild(node);
          if (lineFlowBox.getChildren().length === 0) {
            parent.deleteChild(lineFlowBox);
          } else {
            this.updatedLineFlowBoxes.push(lineFlowBox);
          }
          break;
        }
      }
      return;
    }
    if (parent instanceof InlineBox && node instanceof AtomicBox) {
      parent.deleteChild(node);
      return;
    }
    throw new Error('Error deleting box, type mismatch.');
  }

  updateNode(node: Box, srcNode: RenderNode): boolean {
    if (node instanceof DocBox && srcNode instanceof DocRenderNode) {
      if (srcNode.getVersion() <= this.lastVersion) {
        return false;
      }
      // Join block boxes that were split by reflow
      let lastChild: BlockBox | undefined;
      for (let n = 0; n < node.getChildren().length; n++) {
        const pageFlowBox = node.getChildren()[n];
        for (let m = 0; m < pageFlowBox.getChildren().length; m++) {
          const blockBox = pageFlowBox.getChildren()[m];
          if (lastChild && blockBox.getRenderNodeID() === lastChild.getRenderNodeID()) {
            lastChild.join(blockBox);
            bumpVersionForBlockBoxAndDescendents(lastChild, srcNode.getVersion());
            pageFlowBox.deleteChild(blockBox);
            m--;
          } else {
            lastChild = blockBox;
          }
        }
        if (pageFlowBox.getChildren().length === 0) {
          node.deleteChild(pageFlowBox);
          n--;
        } else {
          this.updatedPageFlowBoxes.push(pageFlowBox);
        }
      }
      node.onRenderUpdated(srcNode);
      node.setVersion(srcNode.getVersion());
      return true;
    }
    if (node instanceof BlockBox && srcNode instanceof BlockRenderNode) {
      if (srcNode.getVersion() <= this.lastVersion) {
        return false;
      }
      // Join inline boxes that were split by reflow
      let lastChild: InlineBox | undefined;
      for (let n = 0; n < node.getChildren().length; n++) {
        const lineFlowBox = node.getChildren()[n];
        for (let m = 0; m < lineFlowBox.getChildren().length; m++) {
          const inlineBox = lineFlowBox.getChildren()[m];
          if (lastChild && inlineBox.getRenderNodeID() === lastChild.getRenderNodeID()) {
            lastChild.join(inlineBox);
            lineFlowBox.deleteChild(inlineBox);
            m--;
          } else {
            lastChild = inlineBox;
          }
        }
        if (lineFlowBox.getChildren().length === 0) {
          node.deleteChild(lineFlowBox);
          n--;
        } else {
          this.updatedLineFlowBoxes.push(lineFlowBox);
        }
      }
      node.onRenderUpdated(srcNode);
      node.setVersion(srcNode.getVersion());
      const lineFlowBox = node.getParent();
      if (lineFlowBox.getVersion() < srcNode.getVersion()) {
        lineFlowBox.setVersion(srcNode.getVersion());
      }
      this.updatedPageFlowBoxes.push(lineFlowBox);
      return true;
    }
    if (node instanceof InlineBox && srcNode instanceof InlineRenderNode) {
      if (srcNode.getVersion() <= this.lastVersion) {
        return false;
      }
      // Join atomic boxes that were split by reflow
      let lastChild: AtomicBox | undefined;
      for (let n = 0; n < node.getChildren().length; n++) {
        const atomicBox = node.getChildren()[n];
        if (lastChild && atomicBox.getRenderNodeID() === lastChild.getRenderNodeID()) {
          lastChild.join(atomicBox);
          node.deleteChild(atomicBox);
          n--;
        } else {
          lastChild = atomicBox;
        }
      }
      node.onRenderUpdated(srcNode);
      node.setVersion(srcNode.getVersion());
      const lineFlowBox = node.getParent();
      if (lineFlowBox.getVersion() < srcNode.getVersion()) {
        lineFlowBox.setVersion(srcNode.getVersion());
      }
      this.updatedLineFlowBoxes.push(lineFlowBox);
      return true;
    }
    if (node instanceof AtomicBox && srcNode instanceof AtomicRenderNode) {
      if (srcNode.getVersion() <= this.lastVersion) {
        return false;
      }
      node.onRenderUpdated(srcNode);
      node.setVersion(srcNode.getVersion());
      return true;
    }
    throw new Error('Error updating box, type mismatch.');
  }
}

export default class LayoutEngine {
  protected editor: Editor;
  protected docBox: DocBox;
  protected version: number;
  
  constructor(editor: Editor, docBox: DocBox) {
    this.editor = editor;
    this.docBox = docBox;
    this.version = -1;
    editor.getDispatcher().on(RenderStateUpdatedEvent, event => this.sync());
    this.sync();
  }

  protected sync() {
    const docRenderNode = this.editor.getRenderManager().getDocRenderNode();
    const treeSyncer = new RenderToLayoutTreeSyncer(this.editor, this.version);
    treeSyncer.syncNodes(docRenderNode, this.docBox);
    const newVersion = docRenderNode.getVersion();
    const updatedLineFlowBoxes = treeSyncer.getUpdatedLineFlowBoxes();
    let lastLineFlowBox: LineFlowBox | undefined = undefined;
    updatedLineFlowBoxes.forEach(lineFlowBox => {
      if (lastLineFlowBox && lastLineFlowBox === lineFlowBox) {
        return;
      }
      this.reflowLineFlowBox(lineFlowBox, newVersion);
      lastLineFlowBox = lineFlowBox;
    });
    const updatedPageFlowBoxes = treeSyncer.getUpdatedPageFlowBoxes();
    let lastPageFlowBox: PageFlowBox | undefined = undefined;
    updatedPageFlowBoxes.forEach(pageFlowBox => {
      if (lastPageFlowBox && lastPageFlowBox === pageFlowBox) {
        return;
      }
      this.reflowPageFlowBox(pageFlowBox, newVersion);
      lastPageFlowBox = pageFlowBox;
    });
    this.version = newVersion;
    this.editor.getDispatcher().dispatch(new LayoutStateUpdatedEvent());
  }

  protected reflowLineFlowBox(lineFlowBox: LineFlowBox, version: number) {
    if (lineFlowBox.isDeleted()) {
      // Line flow box was already deleted, nothing to
      // do here
      return;
    }
    lineFlowBox.onRenderUpdated();
    lineFlowBox.setVersion(version);
    let currentLineFlowBox = lineFlowBox;
    const blockBox = currentLineFlowBox.getParent();
    if (blockBox.getChildren().indexOf(currentLineFlowBox) < 0) {
      // Line box was already reflowed and removed when
      // reflowing a previous line, nothing more needs
      // to be done
      return;
    }
    const lineFlowBoxWidth = currentLineFlowBox.getWidth();
    let cumulatedWidth = 0;
    let n = 0;
    while (true) {
      let inlineBox = currentLineFlowBox.getChildren()[n];
      while (cumulatedWidth + inlineBox.getWidthWithoutTrailingWhitespace() > lineFlowBoxWidth) {
        // With this inline box, the line width limit gets exceeded,
        // so we need to determine where to cleave this inline box
        for (let m = 0; m < inlineBox.getChildren().length; m++) {
          let atomicBox = inlineBox.getChildren()[m];
          while (atomicBox.getWidthWithoutTrailingWhitespace() > lineFlowBoxWidth) {
            // Edge case where atomic box is wider than line, in this
            // case we need to break up the atomic box into pieces that
            // fit as closely to the line width as possible
            if (cumulatedWidth > 0) {
              // If the current line already has content, split the line
              const newLineFlowBox = currentLineFlowBox.splitAt(n + 1);
              currentLineFlowBox.setVersion(version);
              newLineFlowBox.setVersion(version);
              blockBox.insertChild(newLineFlowBox, blockBox.getChildren().indexOf(currentLineFlowBox) + 1);
              currentLineFlowBox = newLineFlowBox;
              n = 0;
              const newInlineBox = inlineBox.splitAt(m);
              if (inlineBox.getChildren().length === 0) {
                inlineBox.getParent().deleteChild(inlineBox);
              } else {
                inlineBox.setVersion(version);
              }
              newInlineBox.setVersion(version);
              currentLineFlowBox.insertChild(newInlineBox, currentLineFlowBox.getChildren().indexOf(inlineBox) + 1);
              inlineBox = newInlineBox;
              m = 0;
            }
            const newLineFlowBox = currentLineFlowBox.splitAt(n + 1);
            currentLineFlowBox.setVersion(version);
            newLineFlowBox.setVersion(version);
            blockBox.insertChild(newLineFlowBox, blockBox.getChildren().indexOf(currentLineFlowBox) + 1);
            currentLineFlowBox = newLineFlowBox;
            n = 0;
            const newInlineBox = inlineBox.splitAt(m + 1);
            if (inlineBox.getChildren().length === 0) {
              inlineBox.getParent().deleteChild(inlineBox);
            } else {
              inlineBox.setVersion(version);
            }
            newInlineBox.setVersion(version);
            currentLineFlowBox.insertChild(newInlineBox, currentLineFlowBox.getChildren().indexOf(inlineBox) + 1);
            inlineBox = newInlineBox;
            m = 0;
            const newAtomicBox = atomicBox.splitAtWidth(lineFlowBoxWidth);
            atomicBox.setVersion(version);
            newAtomicBox.setVersion(version);
            inlineBox.insertChild(newAtomicBox, inlineBox.getChildren().indexOf(atomicBox) + 1);
            atomicBox = newAtomicBox;
            cumulatedWidth = 0;
          }
          if (cumulatedWidth + atomicBox.getWidthWithoutTrailingWhitespace() > lineFlowBoxWidth) {
            // With this atomic box, the line width limit gets exceeded,
            // so we cleave the line box after this inline box, and then
            // cleave the inline box before this atomic box
            const newLineFlowBox = currentLineFlowBox.splitAt(n + 1);
            currentLineFlowBox.setVersion(version);
            newLineFlowBox.setVersion(version);
            blockBox.insertChild(newLineFlowBox, blockBox.getChildren().indexOf(currentLineFlowBox) + 1);
            currentLineFlowBox = newLineFlowBox;
            n = 0;
            const newInlineBox = inlineBox.splitAt(m);
            if (inlineBox.getChildren().length === 0) {
              inlineBox.getParent().deleteChild(inlineBox);
            } else {
              inlineBox.setVersion(version);
            }
            newInlineBox.setVersion(version);
            currentLineFlowBox.insertChild(newInlineBox, currentLineFlowBox.getChildren().indexOf(inlineBox) + 1);
            inlineBox = newInlineBox;
            m = 0;
            cumulatedWidth = 0;
            break;
          }
          cumulatedWidth += atomicBox.getWidth();
        }
      }
      cumulatedWidth += inlineBox.getWidth();
      n++;
      if (n === currentLineFlowBox.getChildren().length) {
        const lineFlowBoxOffset = blockBox.getChildren().indexOf(currentLineFlowBox) + 1;
        if (lineFlowBoxOffset >= blockBox.getChildren().length) {
          // Last line flow box in block box reached
          break;
        }
        const nextLineFlowBox = blockBox.getChildren()[lineFlowBoxOffset];
        const nextAtomicBox = nextLineFlowBox.getChildren()[0].getChildren()[0];
        if (cumulatedWidth + nextAtomicBox.getWidth() <= currentLineFlowBox.getWidth()) {
          // The first atomic box of the next line box can fit on this
          // line box, so we merge the next line box into this line box
          // and continue with reflow
          nextLineFlowBox.getChildren().forEach(nextInlineBox => {
            currentLineFlowBox.insertChild(nextInlineBox, currentLineFlowBox.getChildren().length);
            nextInlineBox.setVersion(version);
          });
          blockBox.deleteChild(nextLineFlowBox);
        } else {
          break;
        }
      }
    }
  }

  protected reflowPageFlowBox(pageFlowBox: PageFlowBox, version: number) {
    if (pageFlowBox.isDeleted()) {
      // Page flow box was already deleted, nothing to
      // do here
      return;
    }
    pageFlowBox.onRenderUpdated();
    pageFlowBox.setVersion(version);
    let currentPageFlowBox = pageFlowBox;
    const docBox = currentPageFlowBox.getParent();
    if (docBox.getChildren().indexOf(currentPageFlowBox) < 0) {
      // Page box was already reflowed and removed when
      // reflowing a previous page, nothing more needs
      // to be done
      return;
    }
    const pageFlowBoxHeight = currentPageFlowBox.getInnerHeight();
    let cumulatedHeight = 0;
    let n = 0;
    while (true) {
      let blockBox = currentPageFlowBox.getChildren()[n];
      while (cumulatedHeight + blockBox.getHeight() > pageFlowBoxHeight) {
        // With this block box, the page height limit gets exceeded,
        // so we need to determine where to cleave this block box
        for (let m = 0; m < blockBox.getChildren().length; m++) {
          let lineFlowBox = blockBox.getChildren()[m];
          if (cumulatedHeight + lineFlowBox.getHeight() > pageFlowBoxHeight) {
            // With this line box, the page height limit gets exceeded,
            // so we cleave the page box after this block box, and then
            // cleave the block box before this line box
            const newPageFlowBox = currentPageFlowBox.splitAt(n + 1);
            currentPageFlowBox.setVersion(version);
            newPageFlowBox.setVersion(version);
            docBox.insertChild(newPageFlowBox, docBox.getChildren().indexOf(currentPageFlowBox) + 1);
            currentPageFlowBox = newPageFlowBox;
            n = 0;
            const newBlockBox = blockBox.splitAt(m);
            if (blockBox.getChildren().length === 0) {
              blockBox.getParent().deleteChild(blockBox);
            } else {
              blockBox.setVersion(version);
            }
            bumpVersionForBlockBoxAndDescendents(newBlockBox, version);
            currentPageFlowBox.insertChild(newBlockBox, currentPageFlowBox.getChildren().indexOf(blockBox) + 1);
            blockBox = newBlockBox;
            m = 0;
            cumulatedHeight = 0;
            break;
          }
          cumulatedHeight += lineFlowBox.getHeight();
        }
      }
      cumulatedHeight += blockBox.getHeight();
      n++;
      if (n === currentPageFlowBox.getChildren().length) {
        const pageFlowBoxOffset = docBox.getChildren().indexOf(currentPageFlowBox) + 1;
        if (pageFlowBoxOffset >= docBox.getChildren().length) {
          // Last page flow box in doc box reached
          break;
        }
        const nextPageFlowBox = docBox.getChildren()[pageFlowBoxOffset];
        const nextLineFlowBox = nextPageFlowBox.getChildren()[0].getChildren()[0];
        if (cumulatedHeight + nextLineFlowBox.getHeight() <= currentPageFlowBox.getInnerHeight()) {
          // The first line box of the next page box can fit on this
          // page box, so we merge the next page box into this page box
          // and continue with reflow
          nextPageFlowBox.getChildren().forEach(nextBlockBox => {
            currentPageFlowBox.insertChild(nextBlockBox, currentPageFlowBox.getChildren().length);
            bumpVersionForBlockBoxAndDescendents(nextBlockBox, version);
          });
          docBox.deleteChild(nextPageFlowBox);
        } else {
          break;
        }
      }
    }
  }
}