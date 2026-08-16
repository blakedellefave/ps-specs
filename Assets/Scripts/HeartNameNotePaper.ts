import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"

export const DEFAULT_NOTE_WIDTH = 16.8
export const DEFAULT_NOTE_HEIGHT = 21.8
export const PAPER_HEADER_OFFSET = 2.3
export const CIRCULAR_BUTTON_SIZE = 4.2

/** Builds the shared composition-paper surface used by written and blank P.S. notes. */
export function buildHeartNameLinedPaper(
  parent: SceneObject,
  width: number,
  height: number,
): RoundedRectangle[] {
  const visuals: RoundedRectangle[] = []

  const paperObject = createObject(parent, "Welcome Note Paper")
  paperObject.getTransform().setLocalPosition(new vec3(0, 0, -0.22))
  const paper = paperObject.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
  paper.size = new vec2(width, height)
  paper.cornerRadius = 0.65
  paper.backgroundColor = new vec4(0.82, 0.94, 1, 0.8)
  // Keep the paper edge clean; the Frame must not read as a tinted outline.
  paper.border = false
  paper.opacity = 1
  visuals.push(paper)

  const usableHeight = height - 1.5
  const lineSpacing = 1.65
  const lineCount = Math.floor(usableHeight / lineSpacing)
  const top = usableHeight * 0.5 + 0.62 - PAPER_HEADER_OFFSET
  for (let i = 0; i < lineCount; i++) {
    const lineObject = createObject(parent, "Paper Rule " + (i + 1))
    lineObject.getTransform().setLocalPosition(new vec3(0, top - i * lineSpacing, -0.12))
    const line = lineObject.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    line.size = new vec2(width - 0.8, 0.055)
    line.cornerRadius = 0.0275
    line.backgroundColor = new vec4(0.35, 0.68, 0.9, 0.42)
    line.border = false
    line.opacity = 1
    visuals.push(line)
  }

  const marginObject = createObject(parent, "Paper Margin")
  marginObject.getTransform().setLocalPosition(new vec3(-width * 0.34, 0, -0.08))
  const margin = marginObject.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
  margin.size = new vec2(0.065, height - 0.75)
  margin.cornerRadius = 0.0325
  margin.backgroundColor = new vec4(0.96, 0.39, 0.48, 0.48)
  margin.border = false
  margin.opacity = 1
  visuals.push(margin)

  return visuals
}

function createObject(parent: SceneObject, name: string): SceneObject {
  const object = global.scene.createSceneObject(name)
  object.setParent(parent)
  return object
}
