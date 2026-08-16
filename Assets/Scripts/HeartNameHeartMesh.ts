/**
 * HeartNameHeartMesh — owns the procedural extruded heart and its soft halo.
 * Inputs: translucent core material and additive halo material.
 * Must not own UI or experience state.
 */
@component
export class HeartNameHeartMesh extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">HeartNameHeartMesh – glowing heart geometry</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Translucent light-blue material for the heart core")
  coreMaterial!: Material

  @input
  @hint("Additive light-blue material for the outer glow")
  haloMaterial!: Material
  @ui.group_end

  onAwake(): void {
    const mesh = this.buildHeartMesh()

    const core = this.sceneObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    core.mesh = mesh
    if (this.coreMaterial) core.mainMaterial = this.coreMaterial

    const haloObject = global.scene.createSceneObject("Heart Halo")
    haloObject.setParent(this.sceneObject)
    haloObject.getTransform().setLocalScale(new vec3(1.13, 1.13, 1.13))
    const halo = haloObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    halo.mesh = mesh
    if (this.haloMaterial) halo.mainMaterial = this.haloMaterial
  }

  private buildHeartMesh(): RenderMesh {
    const builder = new MeshBuilder([
      {name: "position", components: 3},
      {name: "normal", components: 3, normalized: true},
      {name: "color", components: 4},
    ])
    builder.topology = MeshTopology.Triangles
    builder.indexType = MeshIndexType.UInt16

    const outline: [number, number][] = []
    const count = 48
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2
      const x = 16 * Math.pow(Math.sin(t), 3)
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
      outline.push([x * 0.39, y * 0.39])
    }
    this.extrude(builder, outline, 1.7, [0.35, 0.82, 1.0, 0.62])
    builder.updateMesh()
    return builder.getMesh()
  }

  private extrude(
    builder: MeshBuilder,
    input: [number, number][],
    depth: number,
    color: [number, number, number, number],
  ): void {
    let area = 0
    for (let i = 0; i < input.length; i++) {
      const a = input[i]
      const b = input[(i + 1) % input.length]
      area += a[0] * b[1] - b[0] * a[1]
    }
    const poly = area < 0 ? input.slice().reverse() : input
    const n = poly.length
    const halfDepth = depth * 0.5
    const indices: number[] = []

    for (let i = 0; i < n; i++) {
      builder.appendVerticesInterleaved([
        poly[i][0], poly[i][1], halfDepth,
        0, 0, 1,
        ...color,
      ])
    }
    for (let i = 0; i < n; i++) {
      builder.appendVerticesInterleaved([
        poly[i][0], poly[i][1], -halfDepth,
        0, 0, -1,
        ...color,
      ])
    }

    const faceTriangles = this.triangulate(poly)
    for (let i = 0; i < faceTriangles.length; i += 3) {
      indices.push(faceTriangles[i], faceTriangles[i + 1], faceTriangles[i + 2])
      indices.push(n + faceTriangles[i], n + faceTriangles[i + 2], n + faceTriangles[i + 1])
    }

    let vertexIndex = n * 2
    for (let i = 0; i < n; i++) {
      const p0 = poly[i]
      const p1 = poly[(i + 1) % n]
      const dx = p1[0] - p0[0]
      const dy = p1[1] - p0[1]
      const length = Math.hypot(dy, -dx) || 1
      const nx = dy / length
      const ny = -dx / length
      builder.appendVerticesInterleaved([
        p0[0], p0[1], -halfDepth, nx, ny, 0, ...color,
        p1[0], p1[1], -halfDepth, nx, ny, 0, ...color,
        p1[0], p1[1], halfDepth, nx, ny, 0, ...color,
        p0[0], p0[1], halfDepth, nx, ny, 0, ...color,
      ])
      indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2)
      indices.push(vertexIndex, vertexIndex + 2, vertexIndex + 3)
      vertexIndex += 4
    }
    builder.appendIndices(indices)
  }

  private triangulate(poly: [number, number][]): number[] {
    const remaining: number[] = []
    for (let i = 0; i < poly.length; i++) remaining.push(i)
    const triangles: number[] = []
    let cursor = 0
    let guard = poly.length * 4
    while (remaining.length > 3 && guard-- > 0) {
      const length = remaining.length
      const ia = remaining[(cursor + length - 1) % length]
      const ib = remaining[cursor % length]
      const ic = remaining[(cursor + 1) % length]
      const a = poly[ia]
      const b = poly[ib]
      const c = poly[ic]
      const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
      if (cross > 0) {
        let isEar = true
        for (const pointIndex of remaining) {
          if (pointIndex === ia || pointIndex === ib || pointIndex === ic) continue
          if (this.pointInTriangle(poly[pointIndex], a, b, c)) {
            isEar = false
            break
          }
        }
        if (isEar) {
          triangles.push(ia, ib, ic)
          remaining.splice(cursor % length, 1)
          continue
        }
      }
      cursor++
    }
    if (remaining.length === 3) triangles.push(remaining[0], remaining[1], remaining[2])
    return triangles
  }

  private pointInTriangle(
    point: [number, number],
    a: [number, number],
    b: [number, number],
    c: [number, number],
  ): boolean {
    const d1 = (point[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (point[1] - b[1])
    const d2 = (point[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (point[1] - c[1])
    const d3 = (point[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (point[1] - a[1])
    const hasNegative = d1 < 0 || d2 < 0 || d3 < 0
    const hasPositive = d1 > 0 || d2 > 0 || d3 > 0
    return !(hasNegative && hasPositive)
  }
}
