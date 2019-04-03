import {
  Editor,
  Command,
  StateTransformation,
  CursorTransformation,
  stateOperations,
  cursorOperations,
  OpenTagToken,
  CloseTagToken,
  generateID,
} from '@taleweaver/core';
import EditExtension from '../EditExtension';

export default function breakLine(editExtension: EditExtension): Command {
  return (editor: Editor): [StateTransformation, CursorTransformation] => {
    const cursorAnchor = editor.getCursor().getAnchor();
    const cursorHead = editor.getCursor().getHead();
    const anchor = editor.convertSelectableOffsetToModelOffset(cursorAnchor);
    const head = editor.convertSelectableOffsetToModelOffset(cursorHead);
    const stateTransformation = new StateTransformation();
    const cursorTransformation = new CursorTransformation();
    if (anchor !== head) {
      stateTransformation.addOperation(new stateOperations.Delete(Math.min(anchor, head), Math.max(anchor, head) - 1));
    }
    const insertAt = Math.min(anchor, head);
    stateTransformation.addOperation(new stateOperations.Insert(insertAt, [
      '\n',
      new CloseTagToken(),
      new CloseTagToken(),
      new OpenTagToken('Paragraph', { id: generateID() }),
      new OpenTagToken('Text', { id: generateID() }),
    ]));
    cursorTransformation.addOperation(new cursorOperations.MoveTo(Math.min(cursorAnchor, cursorHead) + 1));
    return [stateTransformation, cursorTransformation];
  };
}