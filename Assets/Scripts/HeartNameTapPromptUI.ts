/**
 * HeartNameTapPromptUI — owns the compact touch button below the heart.
 * The main controller may hide it and subscribes to its trigger event.
 */
import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {CIRCULAR_BUTTON_SIZE} from "./HeartNameNotePaper"

const TOUCH_ICON = requireAsset("../Icons/touch_app.png") as Texture

@component
export class HeartNameTapPromptUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">HeartNameTapPromptUI – touch prompt button</span>')

  private visualRoot!: SceneObject
  private readonly tapEvent = new Event<void>()

  public get onTap(): PublicApi<void> {
    return this.tapEvent.publicApi()
  }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    this.sceneObject.createComponent(Billboard.getTypeName())

    this.visualRoot = this.createObject(this.sceneObject, "Tap Heart Button")
    const button = this.visualRoot.createComponent(Button.getTypeName()) as Button
    button.setVariant({theme: "SnapOS2", shape: "Round", style: "Primary"})
    button.size = new vec3(CIRCULAR_BUTTON_SIZE, CIRCULAR_BUTTON_SIZE, 1)
    button.opacity = 0.72
    button.onTriggerUp.add(() => this.tapEvent.invoke())

    const icon = this.visualRoot.createComponent(ElementContent.getTypeName()) as ElementContent
    icon.leadingIcon = TOUCH_ICON
    icon.leadingIconSize = 2
    icon.sizeOverride = new vec2(CIRCULAR_BUTTON_SIZE, CIRCULAR_BUTTON_SIZE)
    icon.contentAlignment = "center"
  }

  public hide(): void {
    if (this.visualRoot) this.visualRoot.enabled = false
  }

  public show(): void {
    if (this.visualRoot) this.visualRoot.enabled = true
  }

  private createObject(parent: SceneObject, name: string): SceneObject {
    const object = global.scene.createSceneObject(name)
    object.setParent(parent)
    return object
  }
}
