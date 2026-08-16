/**
 * HeartNameWelcomeNoteUI — owns the clear welcome note revealed after the heart pops.
 * The main controller controls visibility; this module owns all note layout and text.
 */
import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"
import {TargetingVisual} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
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
import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {
  buildHeartNameLinedPaper,
  CIRCULAR_BUTTON_SIZE,
  DEFAULT_NOTE_HEIGHT,
  DEFAULT_NOTE_WIDTH,
  PAPER_HEADER_OFFSET,
} from "./HeartNameNotePaper"

const NOTE_FONT = requireAsset("../Fonts/Edu NSW ACT Cursive.ttf") as Font
const HEART_ICON = requireAsset("../Icons/favorite.png") as Texture

const LEAVE_BUTTON_GAP = 1

@component
export class HeartNameWelcomeNoteUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">HeartNameWelcomeNoteUI – revealed welcome note</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Message displayed after the heart is tapped")
  @widget(new TextAreaWidget())
  noteText: string = "Welcome to P.S. a unique shared experience designed for SPECS! Just like writing a letter, leave a P.S. anywhere in your environment that you would like to share some context for the next user."

  @input
  @hint("Welcome note width in centimeters")
  @widget(new SliderWidget(14, 28, 0.1))
  panelWidth: number = DEFAULT_NOTE_WIDTH

  @input
  @hint("Welcome note height in centimeters")
  @widget(new SliderWidget(10, 24, 0.1))
  panelHeight: number = DEFAULT_NOTE_HEIGHT
  @ui.group_end

  private visualRoot!: SceneObject
  private frame!: Frame
  private contentRoot!: SceneObject
  private leaveButtonObject!: SceneObject
  private leaveButton!: Button
  private noteTextVisual!: Text
  private paperVisuals: RoundedRectangle[] = []
  private initialized = false
  private wantVisible = false
  private fading = false
  private fadeElapsed = 0
  private fadeDuration = 0.45
  private buttonReadyAt = Number.POSITIVE_INFINITY
  private initialVisualPosition = vec3.zero()
  private initialVisualRotation = quat.quatIdentity()
  private initialVisualScale = vec3.one()
  private readonly leavePsEvent = new Event<void>()

  public get onLeavePs(): PublicApi<void> {
    return this.leavePsEvent.publicApi()
  }

  public getWorldPosition(): vec3 {
    return this.sceneObject.getTransform().getWorldPosition()
  }

  public getWorldScale(): vec3 {
    return this.sceneObject.getTransform().getWorldScale()
  }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    this.sceneObject.createComponent(Billboard.getTypeName())
    this.createEvent("UpdateEvent").bind(() => this.updateFade())

    this.visualRoot = this.createObject(this.sceneObject, "Welcome Note Visual")
    this.initialVisualPosition = this.visualRoot.getTransform().getLocalPosition()
    this.initialVisualRotation = this.visualRoot.getTransform().getLocalRotation()
    this.initialVisualScale = this.visualRoot.getTransform().getLocalScale()
    const frame = this.visualRoot.createComponent(Frame.getTypeName()) as Frame
    this.frame = frame
    frame.autoShowHide = false
    frame.autoScaleContent = false
    frame.allowScaling = false
    frame.allowTranslation = true

    frame.onInitialized.add(() => {
      frame.showCloseButton = false
      frame.showFollowButton = false
      frame.innerSize = new vec2(this.panelWidth, this.panelHeight)
      frame.padding = new vec2(0.25, 0.25)
      this.contentRoot = this.buildContent(frame.contentTransform.getSceneObject())
      this.buildLeaveButton()

      // Keep the card movable while suppressing the InteractionPlane cursor that
      // previously flashed as a dotted vertical line during the heart transition.
      frame.interactionPlane.targetingVisual = TargetingVisual.None
      frame.collider.enabled = false
      frame.interactionPlane.enabled = false
      this.hideFrameChrome()

      // Keep the initialized host alive, but hide its renderable pieces separately.
      // Revealing both in one call avoids a one-frame intermediate Frame state.
      frame.opacity = 0
      this.contentRoot.enabled = false
      this.leaveButtonObject.enabled = false
      this.initialized = true
      if (this.wantVisible) this.revealNote()
    })
  }

  public showNote(): void {
    this.wantVisible = true
    if (this.initialized) this.revealNote()
  }

  public fadeOut(duration: number = 0.45): void {
    if (!this.initialized || !this.wantVisible || this.fading) return
    this.fading = true
    this.fadeElapsed = 0
    this.fadeDuration = Math.max(0.05, duration)
    this.frame.collider.enabled = false
    // The action is complete once placement commits; remove its external
    // control immediately while the paper and writing fade together.
    this.leaveButtonObject.enabled = false
  }

  public resetToStartup(): void {
    this.wantVisible = false
    this.fading = false
    this.fadeElapsed = 0
    this.buttonReadyAt = Number.POSITIVE_INFINITY
    const transform = this.visualRoot.getTransform()
    transform.setLocalPosition(this.initialVisualPosition)
    transform.setLocalRotation(this.initialVisualRotation)
    transform.setLocalScale(this.initialVisualScale)
    this.frame.opacity = 0
    this.frame.collider.enabled = false
    this.hideFrameChrome()
    if (this.contentRoot) this.contentRoot.enabled = false
    if (this.leaveButtonObject) this.leaveButtonObject.enabled = false
    this.setVisualOpacity(1)
  }

  private revealNote(): void {
    // Expose the complete card first, then enable movement. This prevents the
    // heart's final pinch/hover from transferring to an invisible Frame state.
    // The Frame is interaction-only. Its dark backing must remain invisible.
    this.frame.opacity = 0
    this.hideFrameChrome()
    this.contentRoot.enabled = true
    this.leaveButtonObject.enabled = true
    this.frame.collider.enabled = true
    this.frame.interactionPlane.targetingVisual = TargetingVisual.None
    this.frame.interactionPlane.enabled = false
    this.buttonReadyAt = getTime() + 0.55
    this.setVisualOpacity(1)
  }

  private updateFade(): void {
    if (!this.fading) return
    this.fadeElapsed += getDeltaTime()
    const t = Math.min(1, this.fadeElapsed / this.fadeDuration)
    const opacity = 1 - t * t * (3 - 2 * t)
    this.setVisualOpacity(opacity)
    if (t < 1) return
    this.fading = false
    this.wantVisible = false
    this.contentRoot.enabled = false
    this.leaveButtonObject.enabled = false
  }

  private setVisualOpacity(opacity: number): void {
    // Fade only the custom paper/content; never reveal UIKit's dark Frame plate.
    this.frame.opacity = 0
    for (const visual of this.paperVisuals) visual.opacity = opacity
    if (this.noteTextVisual) {
      this.noteTextVisual.textFill.color = new vec4(0.08, 0.2, 0.34, 0.96 * opacity)
    }
    if (this.leaveButton) this.leaveButton.opacity = 0.72 * opacity
  }

  private buildContent(host: SceneObject): SceneObject {
    const content = this.createObject(host, "Welcome Note Content")
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))

    this.buildLinedPaper(content)

    // A composition sheet has a deeper header margin above the first writing
    // row. Keep the writing and rules on the same offset so they cannot drift.
    const writingArea = this.createObject(content, "Welcome Note Writing Area")
    writingArea.getTransform().setLocalPosition(new vec3(0, -PAPER_HEADER_OFFSET, 0))
    const column = writingArea.createComponent(FlexLayout.getTypeName()) as FlexLayout
    column.autoDiscoverItemsOnStart = false
    column.width = this.panelWidth
    column.height = this.panelHeight
    column.direction = FlexDirection.Column
    column.alignItems = FlexAlign.Stretch
    column.justifyContent = FlexJustify.Center
    column.rowGap = 0.35
    column.paddingTop = 0.25
    column.paddingBottom = 0.25
    column.paddingLeft = 0.25
    column.paddingRight = 0.25

    const textObject = this.createObject(writingArea, "Welcome Note Text")
    const text = textObject.createComponent("Component.Text") as Text
    this.noteTextVisual = text
    // Begin the message on the paper's first ruled writing line.
    text.text = this.noteText
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
    // Keep the writing to the right of the notebook's red margin. The width
    // tracks panelWidth so Inspector resizing preserves both paper margins.
    item.alignSelf = FlexAlignSelf.End
    item.overrideWidth = this.panelWidth * 0.84 - 1.5
    item.marginRight = 0.75
    // The placement button now floats outside the paper, so the writing can
    // reclaim the vertical space that the old in-note pill used to reserve.
    item.overrideHeight = this.panelHeight - 0.8

    column.addItems([item])
    return content
  }

  private buildLeaveButton(): void {
    this.leaveButtonObject = this.createObject(this.visualRoot, "Leave a P.S. Button")
    this.leaveButtonObject.getTransform().setLocalPosition(
      new vec3(0, -this.panelHeight * 0.5 - LEAVE_BUTTON_GAP - CIRCULAR_BUTTON_SIZE * 0.5, 0.75)
    )

    this.leaveButton = this.leaveButtonObject.createComponent(Button.getTypeName()) as Button
    this.leaveButton.setVariant({theme: "SnapOS2", shape: "Round", style: "Primary"})
    this.leaveButton.size = new vec3(CIRCULAR_BUTTON_SIZE, CIRCULAR_BUTTON_SIZE, 1)
    this.leaveButton.opacity = 0.72
    this.leaveButton.onTriggerUp.add(() => {
      // The card is revealed from the original heart's pinch. Ignore that
      // same release if it propagates into this newly enabled button.
      if (getTime() >= this.buttonReadyAt) this.leavePsEvent.invoke()
    })

    const icon = this.leaveButtonObject.createComponent(ElementContent.getTypeName()) as ElementContent
    icon.leadingIcon = HEART_ICON
    icon.leadingIconSize = 2
    icon.sizeOverride = new vec2(CIRCULAR_BUTTON_SIZE, CIRCULAR_BUTTON_SIZE)
    icon.contentAlignment = "center"
  }

  private buildLinedPaper(parent: SceneObject): void {
    this.paperVisuals = buildHeartNameLinedPaper(parent, this.panelWidth, this.panelHeight)
  }

  private hideFrameChrome(): void {
    this.frame.opacity = 0
    this.frame.roundedRectangle.opacity = 0
    this.frame.roundedRectangle.enabled = false
    const frameObject = this.findDescendant(this.visualRoot, "FrameObject")
    const visual = frameObject?.getComponent("Component.RenderMeshVisual") as RenderMeshVisual | null
    if (visual) visual.enabled = false
  }

  private findDescendant(parent: SceneObject, name: string): SceneObject | null {
    for (let i = 0; i < parent.getChildrenCount(); i++) {
      const child = parent.getChild(i)
      if (child.name === name) return child
      const nested = this.findDescendant(child, name)
      if (nested) return nested
    }
    return null
  }

  private createObject(parent: SceneObject, name: string): SceneObject {
    const object = global.scene.createSceneObject(name)
    object.setParent(parent)
    return object
  }
}
