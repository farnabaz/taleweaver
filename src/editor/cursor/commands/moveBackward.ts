import TaleWeaver from '../../TaleWeaver';
import Command from './Command';
import Transformation from '../Transformation';
import Translate from '../operations/Translate';

export default function moveBackward(): Command {
  return (taleWeaver: TaleWeaver): Transformation => {
    const transformation = new Transformation();
    const editorCursor = taleWeaver.getEditorCursor();
    if (!editorCursor) {
      return transformation;
    }
    const anchor = editorCursor.getAnchor();
    const head = editorCursor.getHead();
    if (anchor === head) {
      if (head < 1) {
        return transformation;
      }
      transformation.addOperation(new Translate(-1));
    } else {
      if (anchor < head) {
        transformation.addOperation(new Translate(anchor - head));
      } else if (anchor > head) {
        transformation.addOperation(new Translate(0));
      }
    }
    return transformation;
  };
}