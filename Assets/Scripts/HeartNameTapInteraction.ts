/**
 * HeartNameTapInteraction — exposes one SIK tap signal for the authored heart.
 * It owns the heart hit volume and must not own experience state or visible UI.
 */
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractorEvent} from "SpectaclesInteractionKit.lspkg/Core/Interactor/InteractorEvent"
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"

@component
export class HeartNameTapInteraction extends BaseScriptComponent {
  public readonly onTap = new Event<InteractorEvent>()
  public readonly onTapComplete = new Event<InteractorEvent>()

  private interactable!: Interactable

  onAwake(): void {
    let collider = this.sceneObject.getComponent("Physics.ColliderComponent") as ColliderComponent | null
    if (!collider) {
      collider = this.sceneObject.createComponent("Physics.ColliderComponent") as ColliderComponent
      const shape = Shape.createBoxShape()
      // Matches the unscaled procedural heart bounds; the authored 0.7 root
      // scale brings this hit volume down with the visible heart.
      shape.size = new vec3(14.5, 13.5, 3)
      collider.shape = shape
    }

    this.interactable = this.sceneObject.getComponent(Interactable.getTypeName()) as Interactable
    if (!this.interactable) {
      this.interactable = this.sceneObject.createComponent(Interactable.getTypeName()) as Interactable
    }
    this.interactable.targetingMode = 3

    this.createEvent("OnStartEvent").bind(() => {
      this.interactable.onTriggerStart.add((event: InteractorEvent) => this.onTap.invoke(event))
      this.interactable.onTriggerEnd.add((event: InteractorEvent) => this.onTapComplete.invoke(event))
    })
  }
}
