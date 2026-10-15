/** Ignore late responses after Clear results and cancel the browser request when possible. */
export class DiscoveryRequest {
  private epoch = 0
  private active: AbortController | null = null

  start() {
    this.active?.abort()
    const controller = new AbortController()
    this.active = controller
    const epoch = ++this.epoch
    return { signal: controller.signal, isCurrent: () => this.epoch === epoch && !controller.signal.aborted }
  }

  clear() {
    this.epoch++
    this.active?.abort()
    this.active = null
  }
}
