import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"
import {TargetingVisual} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {
  FlexAlign,
  FlexAlignSelf,
  FlexDirection,
  FlexJustify,
} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {Frame} from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame"
import {HeartNameBlankNoteCamera} from "./HeartNameBlankNoteCamera"
import {
  HeartNameBlankNoteVoice,
  HeartNameVoiceSnapshot,
  VOICE_PLAYBACK_PILL_HEIGHT,
} from "./HeartNameBlankNoteVoice"
import {HeartNameSessionState} from "./HeartNameSceneContracts"
import {HeartNameTapInteraction} from "./HeartNameTapInteraction"
import {
  buildHeartNameLinedPaper,
  CIRCULAR_BUTTON_SIZE,
  PAPER_HEADER_OFFSET,
} from "./HeartNameNotePaper"

const NOTE_FONT = requireAsset("../Fonts/Edu NSW ACT Cursive.ttf") as Font
const KEYBOARD_ICON = requireAsset("../Icons/keyboard.png") as Texture
const MICROPHONE_ICON = requireAsset("../Icons/mic.png") as Texture
const MICROPHONE_RECORDING_ICON = requireAsset("../Icons/mic_hexff3b30.png") as Texture
const CAMERA_ICON = requireAsset("../Icons/photo_camera.png") as Texture
const VOICE_MICROPHONE = requireAsset("../Audio/PS Voice Microphone.micaudio") as AudioTrackAsset
const VOICE_PLAYBACK = requireAsset("../Audio/PS Voice Playback.audioOutput") as AudioTrackAsset

const TOOLBAR_GAP = 1.2
const TOOLBAR_NOTE_GAP = 1
const PLAYBACK_PILL_TOOLBAR_GAP = 0.8
const LEAVE_BUTTON_WIDTH = 9
const LEAVE_BUTTON_HEIGHT = 4
const LEAVE_BUTTON_NOTE_GAP = 1

type NoteSnapshot = {
  text: string
  voice: HeartNameVoiceSnapshot
  photo: Texture | null
}

export interface HeartNameBlankNoteHandle {
  readonly root: SceneObject
  closeForPass(): void
  setSessionState(state: HeartNameSessionState): void
}

/** Creates one movable note while keeping its anchored heart and media state intact. */
export function createHeartNameBlankNote(
  parent: SceneObject,
  width: number,
  height: number,
  index: number,
  worldScale: vec3,
  anchoredHeart: SceneObject,
  anchoredHeartScale: vec3,
  initialSessionState: HeartNameSessionState,
  onDone: () => void,
  startOpen: boolean = true,
): HeartNameBlankNoteHandle {
  const root = createObject(parent, "Blank P.S. Note " + index)
  root.getTransform().setLocalPosition(vec3.zero())
  root.getTransform().setLocalRotation(quat.quatIdentity())
  root.getTransform().setWorldScale(worldScale)
  root.createComponent("Component.Canvas")
  root.createComponent(Billboard.getTypeName())

  let sessionState = initialSessionState
  let desiredOpen = startOpen
  let initialized = false
  let composerActive = false
  let personASnapshot: NoteSnapshot | null = null
  let latestSnapshot: NoteSnapshot | null = null
  let noteText: Text | null = null
  let toolbar: SceneObject | null = null
  let voice: HeartNameBlankNoteVoice | null = null
  let camera: HeartNameBlankNoteCamera | null = null
  let mainButtonObject: SceneObject | null = null
  let mainButtonLabel: ElementContent | null = null

  const hasContent = (): boolean =>
    (noteText?.text.trim().length ?? 0) > 0 ||
    (voice?.hasContent() ?? false) ||
    (camera?.hasContent() ?? false)

  const captureSnapshot = (): NoteSnapshot | null => {
    if (!noteText || !voice || !camera) return null
    return {
      text: noteText.text,
      voice: voice.captureContent(),
      photo: camera.captureContent(),
    }
  }

  const restoreSnapshot = (snapshot: NoteSnapshot | null): void => {
    if (!snapshot || !noteText || !voice || !camera) return
    noteText.text = snapshot.text
    voice.restoreContent(snapshot.voice)
    camera.restoreContent(snapshot.photo)
    camera.onContentChanged()
  }

  const clearComposer = (): void => {
    if (!noteText || !voice || !camera) return
    noteText.text = ""
    voice.clearContent()
    camera.clearContent()
    camera.onContentChanged()
  }

  const prepareForHide = (): void => {
    voice?.prepareForHide()
    camera?.prepareForHide()
    global.textInputSystem.dismissKeyboard()
  }

  const refreshPresentation = (): void => {
    if (!initialized || !toolbar || !mainButtonObject || !mainButtonLabel) return
    if (sessionState === HeartNameSessionState.PERSON_A_CREATE) {
      toolbar.enabled = true
      mainButtonLabel.text = "Leave here"
      mainButtonObject.enabled = hasContent()
      return
    }
    if (sessionState === HeartNameSessionState.PERSON_B_REPLY) {
      toolbar.enabled = composerActive
      mainButtonLabel.text = composerActive && hasContent() ? "Leave here" : "Reply"
      mainButtonObject.enabled = true
      return
    }
    toolbar.enabled = false
    mainButtonLabel.text = "Done"
    mainButtonObject.enabled = true
  }

  const closeToHeart = (): void => {
    prepareForHide()
    desiredOpen = false
    root.enabled = false
    anchoredHeart.getTransform().setLocalScale(anchoredHeartScale)
    anchoredHeart.enabled = true
  }

  const openFromHeart = (): void => {
    if (!initialized) return
    if (sessionState === HeartNameSessionState.PERSON_A_FINAL_READ && latestSnapshot) {
      restoreSnapshot(latestSnapshot)
    }
    composerActive = false
    desiredOpen = true
    anchoredHeart.enabled = false
    root.enabled = true
    refreshPresentation()
    console.log("[HeartNameBlankNote] Saved note reopened in " + sessionState)
  }

  const beginReply = (): void => {
    if (!latestSnapshot) latestSnapshot = captureSnapshot()
    if (!personASnapshot) personASnapshot = latestSnapshot
    clearComposer()
    composerActive = true
    refreshPresentation()
    console.log("[HeartNameBlankNote] Reply composer opened")
  }

  const saveAndClose = (): void => {
    prepareForHide()
    if (sessionState === HeartNameSessionState.PERSON_B_REPLY) {
      latestSnapshot = captureSnapshot()
      composerActive = false
      console.log("[HeartNameBlankNote] Person B reply saved")
    } else {
      console.log("[HeartNameBlankNote] Person A content saved")
    }
    closeToHeart()
  }

  const handle: HeartNameBlankNoteHandle = {
    root,
    closeForPass: () => {
      if (composerActive) {
        restoreSnapshot(latestSnapshot)
        composerActive = false
      }
      closeToHeart()
    },
    setSessionState: (state: HeartNameSessionState) => {
      if (state === HeartNameSessionState.PERSON_B_REPLY && !latestSnapshot) {
        latestSnapshot = captureSnapshot()
        if (!personASnapshot) personASnapshot = latestSnapshot
      }
      if (state === HeartNameSessionState.PERSON_A_FINAL_READ && composerActive) {
        restoreSnapshot(latestSnapshot)
        composerActive = false
      }
      sessionState = state
      refreshPresentation()
    },
  }

  let heartTap = anchoredHeart.getComponent(HeartNameTapInteraction.getTypeName()) as HeartNameTapInteraction | null
  if (!heartTap) heartTap = anchoredHeart.createComponent(HeartNameTapInteraction.getTypeName()) as HeartNameTapInteraction
  heartTap.onTapComplete.add(() => openFromHeart())

  const visualRoot = createObject(root, "Blank P.S. Note Visual")
  if (!startOpen) visualRoot.getTransform().setLocalScale(vec3.zero())
  const frame = visualRoot.createComponent(Frame.getTypeName()) as Frame
  frame.autoShowHide = false
  frame.autoScaleContent = false
  frame.allowScaling = false
  frame.allowTranslation = true

  frame.onInitialized.add(() => {
    frame.showCloseButton = false
    frame.showFollowButton = false
    frame.innerSize = new vec2(width, height)
    frame.padding = new vec2(0.25, 0.25)

    const content = createObject(frame.contentTransform.getSceneObject(), "Blank Note Content")
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    buildHeartNameLinedPaper(content, width, height)
    noteText = buildBlankNoteText(content, width, height)
    const tools = buildBlankNoteToolbar(visualRoot, height, noteText)
    toolbar = tools.toolbar
    voice = tools.voice
    camera = tools.camera

    const pill = buildMainPill(visualRoot, height)
    mainButtonObject = pill.object
    mainButtonLabel = pill.label
    pill.button.onTriggerUp.add(() => {
      if (sessionState === HeartNameSessionState.PERSON_A_FINAL_READ) {
        onDone()
        return
      }
      if (sessionState === HeartNameSessionState.PERSON_B_REPLY && !composerActive) {
        beginReply()
        return
      }
      if (hasContent()) saveAndClose()
    })

    const refresh = () => {
      camera?.onContentChanged()
      refreshPresentation()
    }
    tools.addTextChangedListener(refresh)
    voice.addContentChangedListener(refresh)
    camera.addContentChangedListener(refresh)

    frame.interactionPlane.targetingVisual = TargetingVisual.None
    frame.interactionPlane.enabled = false
    frame.collider.enabled = true
    hideFrameChrome(frame, visualRoot)
    initialized = true
    visualRoot.getTransform().setLocalScale(vec3.one())

    if (sessionState === HeartNameSessionState.PERSON_B_REPLY && !latestSnapshot) {
      latestSnapshot = captureSnapshot()
      personASnapshot = latestSnapshot
    }
    refreshPresentation()
    if (!desiredOpen) closeToHeart()
  })

  if (!startOpen) {
    anchoredHeart.enabled = true
  }
  return handle
}

function buildBlankNoteText(parent: SceneObject, width: number, height: number): Text {
  const writingArea = createObject(parent, "Blank Note Writing Area")
  writingArea.getTransform().setLocalPosition(new vec3(0, -PAPER_HEADER_OFFSET, 0))
  const column = writingArea.createComponent(FlexLayout.getTypeName()) as FlexLayout
  column.autoDiscoverItemsOnStart = false
  column.width = width
  column.height = height
  column.direction = FlexDirection.Column
  column.alignItems = FlexAlign.Stretch
  column.justifyContent = FlexJustify.Center
  column.rowGap = 0.35
  column.paddingTop = 0.25
  column.paddingBottom = 0.25
  column.paddingLeft = 0.25
  column.paddingRight = 0.25

  const textObject = createObject(writingArea, "Blank Note Text")
  const text = textObject.createComponent("Component.Text") as Text
  text.text = ""
  text.font = NOTE_FONT
  text.textFill.color = new vec4(0.08, 0.2, 0.34, 0.96)
  text.depthTest = true
  text.size = 39
  ;(text as Text & {weight?: number}).weight = 500
  text.horizontalAlignment = HorizontalAlignment.Center
  text.verticalAlignment = VerticalAlignment.Top
  text.horizontalOverflow = HorizontalOverflow.Wrap
  text.verticalOverflow = VerticalOverflow.Overflow
  text.layoutRect = Rect.create(-0.5, 0.5, -0.5, 0.5)

  const item = textObject.createComponent(FlexItem.getTypeName()) as FlexItem
  item.alignSelf = FlexAlignSelf.End
  item.overrideWidth = width * 0.84 - 1.5
  item.marginRight = 0.75
  item.overrideHeight = height - 0.8
  column.addItems([item])
  return text
}

function buildBlankNoteToolbar(
  parent: SceneObject,
  noteHeight: number,
  noteText: Text,
): {
  toolbar: SceneObject
  voice: HeartNameBlankNoteVoice
  camera: HeartNameBlankNoteCamera
  addTextChangedListener: (listener: () => void) => void
} {
  const toolbar = createObject(parent, "Blank Note Input Toolbar")
  toolbar.getTransform().setLocalPosition(new vec3(
    0,
    -noteHeight * 0.5 - TOOLBAR_NOTE_GAP - CIRCULAR_BUTTON_SIZE * 0.5,
    0.75,
  ))

  const row = toolbar.createComponent(FlexLayout.getTypeName()) as FlexLayout
  row.autoDiscoverItemsOnStart = false
  row.width = CIRCULAR_BUTTON_SIZE * 3 + TOOLBAR_GAP * 2
  row.height = CIRCULAR_BUTTON_SIZE
  row.direction = FlexDirection.Row
  row.alignItems = FlexAlign.Center
  row.justifyContent = FlexJustify.Center
  row.columnGap = TOOLBAR_GAP

  const keyboard = createToolbarButton(toolbar, "Keyboard Button", KEYBOARD_ICON)
  const microphone = createToolbarButton(toolbar, "Microphone Button", MICROPHONE_ICON)
  const camera = createToolbarButton(toolbar, "Camera Button", CAMERA_ICON)

  const playbackMount = createObject(parent, "Voice Playback Pill Mount")
  playbackMount.getTransform().setLocalPosition(new vec3(
    0,
    -noteHeight * 0.5 - TOOLBAR_NOTE_GAP - CIRCULAR_BUTTON_SIZE -
      PLAYBACK_PILL_TOOLBAR_GAP - VOICE_PLAYBACK_PILL_HEIGHT * 0.5,
    0.75,
  ))

  const voice = parent.createComponent(HeartNameBlankNoteVoice.getTypeName()) as HeartNameBlankNoteVoice
  voice.initialize(
    microphone.button,
    microphone.content,
    MICROPHONE_ICON,
    MICROPHONE_RECORDING_ICON,
    VOICE_MICROPHONE,
    VOICE_PLAYBACK,
    playbackMount,
  )
  const noteCamera = parent.createComponent(HeartNameBlankNoteCamera.getTypeName()) as HeartNameBlankNoteCamera
  noteCamera.initialize(noteText, voice, camera.button)
  const textChangedListeners: (() => void)[] = []
  keyboard.button.onTriggerUp.add(() => openKeyboard(noteText, () => {
    noteCamera.onContentChanged()
    for (const listener of textChangedListeners) listener()
  }))
  row.addItems([keyboard.item, microphone.item, camera.item])
  return {
    toolbar,
    voice,
    camera: noteCamera,
    addTextChangedListener: (listener: () => void) => textChangedListeners.push(listener),
  }
}

function buildMainPill(
  parent: SceneObject,
  noteHeight: number,
): {object: SceneObject; button: Button; label: ElementContent} {
  const object = createObject(parent, "Note Main Action Button")
  object.getTransform().setLocalPosition(new vec3(
    0,
    noteHeight * 0.5 + LEAVE_BUTTON_NOTE_GAP + LEAVE_BUTTON_HEIGHT * 0.5,
    0.75,
  ))
  const button = object.createComponent(Button.getTypeName()) as Button
  button.setVariant({theme: "SnapOS2", shape: "Capsule", style: "Primary"})
  button.size = new vec3(LEAVE_BUTTON_WIDTH, LEAVE_BUTTON_HEIGHT, 1)
  button.opacity = 0.78

  const label = object.createComponent(ElementContent.getTypeName()) as ElementContent
  label.text = "Leave here"
  label.textSize = 39
  label.sizeOverride = new vec2(LEAVE_BUTTON_WIDTH, LEAVE_BUTTON_HEIGHT)
  label.contentAlignment = "center"
  object.enabled = false
  return {object, button, label}
}

function openKeyboard(noteText: Text, onTextChanged: () => void): void {
  require("LensStudio:TextInputModule")
  const options = new TextInputSystem.KeyboardOptions()
  options.enablePreview = false
  options.keyboardType = TextInputSystem.KeyboardType.Text
  options.returnKeyType = TextInputSystem.ReturnKeyType.Done
  options.initialText = noteText.text
  options.initialSelectedRange = new vec2(noteText.text.length, noteText.text.length)
  options.onTextChanged = (text: string) => {
    noteText.text = text
    onTextChanged()
  }
  options.onReturnKeyPressed = () => global.textInputSystem.dismissKeyboard()
  options.onKeyboardStateChanged = (isOpen: boolean) => {
    console.log("[HeartNameBlankNote] Keyboard " + (isOpen ? "opened" : "closed"))
  }
  options.onError = (error: number, description: string) => {
    console.error("[HeartNameBlankNote] Keyboard error " + error + ": " + description)
  }
  global.textInputSystem.requestKeyboard(options)
}

function createToolbarButton(
  parent: SceneObject,
  name: string,
  texture: Texture,
): {item: FlexItem; button: Button; content: ElementContent} {
  const object = createObject(parent, name)
  const button = object.createComponent(Button.getTypeName()) as Button
  button.setVariant({theme: "SnapOS2", shape: "Round", style: "Primary"})
  button.size = new vec3(CIRCULAR_BUTTON_SIZE, CIRCULAR_BUTTON_SIZE, 1)
  button.opacity = 0.72

  const icon = object.createComponent(ElementContent.getTypeName()) as ElementContent
  icon.leadingIcon = texture
  icon.leadingIconSize = 2
  icon.sizeOverride = new vec2(CIRCULAR_BUTTON_SIZE, CIRCULAR_BUTTON_SIZE)
  icon.contentAlignment = "center"

  const item = object.createComponent(FlexItem.getTypeName()) as FlexItem
  item.alignSelf = FlexAlignSelf.Center
  item.overrideWidth = CIRCULAR_BUTTON_SIZE
  item.overrideHeight = CIRCULAR_BUTTON_SIZE
  return {item, button, content: icon}
}

function hideFrameChrome(frame: Frame, parent: SceneObject): void {
  frame.opacity = 0
  frame.roundedRectangle.opacity = 0
  frame.roundedRectangle.enabled = false
  const frameObject = findDescendant(parent, "FrameObject")
  const visual = frameObject?.getComponent("Component.RenderMeshVisual") as RenderMeshVisual | null
  if (visual) visual.enabled = false
}

function findDescendant(parent: SceneObject, name: string): SceneObject | null {
  for (let i = 0; i < parent.getChildrenCount(); i++) {
    const child = parent.getChild(i)
    if (child.name === name) return child
    const nested = findDescendant(child, name)
    if (nested) return nested
  }
  return null
}

function createObject(parent: SceneObject, name: string): SceneObject {
  const object = global.scene.createSceneObject(name)
  object.setParent(parent)
  return object
}
