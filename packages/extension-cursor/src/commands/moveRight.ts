import {
  Editor,
  Command,
  StateTransformation,
  CursorTransformation,
  cursorOperations,
} from '@taleweaver/core';
import CursorExtension from '../CursorExtension';

export default function moveRight(cursorExtension: CursorExtension): Command {
  return (editor: Editor): [StateTransformation, CursorTransformation] => {
    const stateTransformation = new StateTransformation();
    const cursorTransformation = new CursorTransformation();
    const cursor = editor.getCursor();
    if (!cursor) {
      return [stateTransformation, cursorTransformation];
    }
    const anchor = cursor.getAnchor();
    const head = cursor.getHead();
    const docBox = editor.getLayoutEngine().getDocBox();
    if (anchor === head) {
      if (head >= docBox.getSelectableSize() - 1) {
        return [stateTransformation, cursorTransformation];
      }
      cursorTransformation.addOperation(new cursorOperations.MoveTo(head + 1));
    } else {
      if (anchor < head) {
        cursorTransformation.addOperation(new cursorOperations.MoveTo(head));
      } else if (anchor > head) {
        cursorTransformation.addOperation(new cursorOperations.MoveTo(anchor));
      }
    }
    return [stateTransformation, cursorTransformation];
  };
}
